// Unit tests for scripts/backfill-accept-conflict-matches.mjs and src/lib/acceptConflictMatches.ts.
// An in-memory stand-in for the database answers the script's statements, so dry run, apply,
// re-runs and "never writes anything else" are tested without a database. Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'

const { runBackfill, formatReport, planRow, payloadOf } = await import('../scripts/backfill-accept-conflict-matches.mjs')
const {
  storedConflictJson, parseStoredConflict, matchIdentity, matchIdText, matchWhereText, curatorConflictMessage,
} = await import('../src/lib/acceptConflictMatches.ts')

const MSG = 'Possible duplicate. Retry with force=true to add anyway.'

const review = (id, extra = {}) => ({
  id, source: 'scopus', external_id: `85${id}`, doi: null, title: 'Robust flows on sparse graphs', journal: 'Proc. SODA',
  entrez_date: '2023-05-01', pub_type: 'Conference Paper', top_cwid: 'abc1001', top_name: 'Ada Lovelace', status: 'open',
  accept_conflict: MSG, accept_conflict_matches: null, ...extra,
})

const pa = (pmid, extra = {}) => ({
  personIdentifier: 'abc1001', pmid, doi: null, articleTitle: 'Robust flows on sparse graphs.', journalTitleVerbose: 'SIAM J Comput',
  publicationDateStandardized: '2023-08-01', articleYear: 2023, ...extra,
})

// A fake mysql2 connection. It understands exactly the statements the script sends and fails
// loudly on anything else, so a write the script must not make would throw.
function fakeDb({ reviews, articles = [], records = [], rejections = [] }) {
  const calls = []
  const unfilled = (r) => r.accept_conflict != null && r.accept_conflict_matches == null
  return {
    reviews, calls,
    async query(sql, params = []) {
      calls.push(sql)
      if (/^SELECT COUNT\(\*\) AS parked, COALESCE\(SUM\(accept_conflict_matches IS NOT NULL\), 0\) AS filled FROM authorship_review WHERE accept_conflict IS NOT NULL$/.test(sql)) {
        const parked = reviews.filter((r) => r.accept_conflict != null)
        return [[{ parked: parked.length, filled: parked.filter((r) => r.accept_conflict_matches != null).length }]]
      }
      if (/^SELECT id, source, .* FROM authorship_review WHERE accept_conflict IS NOT NULL AND accept_conflict_matches IS NULL AND id > \? ORDER BY id LIMIT \?$/.test(sql)) {
        const [after, limit] = params
        return [reviews.filter((r) => unfilled(r) && r.id > after).sort((a, b) => a.id - b.id).slice(0, limit).map((r) => ({ ...r }))]
      }
      if (/^SELECT id, article_id, .* FROM external_record WHERE uid = \?$/.test(sql)) return [records.filter((r) => r.uid === params[0])]
      if (/^SELECT pmid, doi, .* FROM person_article WHERE personIdentifier = \?$/.test(sql)) return [articles.filter((a) => a.personIdentifier === params[0])]
      if (/^SELECT key_type, .* FROM external_rejection WHERE uid = \?$/.test(sql)) return [rejections.filter((r) => r.uid === params[0])]
      if (/^UPDATE authorship_review SET accept_conflict_matches = \? WHERE id = \? AND accept_conflict IS NOT NULL AND accept_conflict_matches IS NULL$/.test(sql)) {
        const [json, id] = params
        let affectedRows = 0
        for (const r of reviews) if (r.id === id && unfilled(r)) { r.accept_conflict_matches = json; affectedRows++ }
        return [{ affectedRows }]
      }
      throw new Error(`unexpected SQL: ${sql}`)
    },
  }
}

const NOW = () => new Date('2026-11-16T12:00:00Z')

test('dry run plans matches and writes nothing', async () => {
  const db = fakeDb({ reviews: [review(1), review(2, { title: 'Something else entirely about cats' }), review(3, { top_cwid: null })], articles: [pa(4001)] })
  const r = await runBackfill(db, { now: NOW })
  assert.equal(r.parked, 3)
  assert.deepEqual({ matched: r.counts.matched, no_match: r.counts.no_match, no_identity: r.counts.no_identity, updated: r.counts.updated },
    { matched: 1, no_match: 1, no_identity: 1, updated: 0 })
  assert.ok(db.reviews.every((x) => x.accept_conflict_matches == null))
  assert.ok(!db.calls.some((s) => /^UPDATE/.test(s)))
  assert.match(formatReport(r), /Would update 1 rows\. Nothing written\./)
})

test('apply stores the match, touches nothing else, and a re-run is a no-op', async () => {
  const db = fakeDb({ reviews: [review(1), review(2, { title: 'Something else entirely about cats' })], articles: [pa(4001)] })
  const before = JSON.parse(JSON.stringify(db.reviews))
  const r = await runBackfill(db, { apply: true, now: NOW })
  assert.equal(r.counts.updated, 1)
  const stored = parseStoredConflict(db.reviews[0].accept_conflict_matches)
  assert.equal(stored.uid, 'abc1001')
  assert.equal(stored.name, 'Ada Lovelace')
  assert.equal(stored.via, 'backfill')
  assert.equal(stored.checked_at, '2026-11-16T12:00:00.000Z')
  assert.deepEqual(stored.matches.map((m) => [m.source, m.idLabel, m.id, m.journal, m.pubYear, m.where]),
    [['PubMed', 'PMID', '4001', 'SIAM J Comput', '2023', 'candidates']])
  // Only accept_conflict_matches changed; status and accept_conflict stay as they were.
  for (const [i, row] of db.reviews.entries()) {
    const { accept_conflict_matches: _a, ...rest } = row
    const { accept_conflict_matches: _b, ...was } = before[i]
    assert.deepEqual(rest, was)
  }
  assert.equal(db.reviews[1].accept_conflict_matches, null)

  const again = await runBackfill(db, { apply: true, now: NOW })
  assert.equal(again.alreadyFilled, 1)
  assert.equal(again.counts.checked, 1) // only the no-match row is looked at again
  assert.equal(again.counts.updated, 0)
})

test('matches against the person\'s external records and rejection memory, one context per person', async () => {
  const records = [{
    uid: 'abc1001', id: 9, article_id: 'SCOPUS:777', source_type: 'SCOPUS', status: 'ACCEPTED', pmid: null, doi: '10.1/abc',
    title: 'Other', pub_date: '2022', container_title: 'Venue', scopus_eid: null, openalex_id: null, orcid_put_code: null,
    title_year_key: null, merged_into_id: null, merged_into_pmid: null,
  }]
  const db = fakeDb({ reviews: [review(1, { doi: 'https://doi.org/10.1/ABC' }), review(2, { doi: '10.1/abc' })], records })
  const r = await runBackfill(db, { apply: true, now: NOW })
  assert.equal(r.counts.updated, 2)
  assert.equal(r.people, 1)
  assert.equal(db.calls.filter((s) => /FROM external_record/.test(s)).length, 1)
  const m = parseStoredConflict(db.reviews[0].accept_conflict_matches).matches[0]
  assert.deepEqual([m.type, m.source, m.idLabel, m.id, m.doi, m.where], ['DOI_MATCH_EXTERNAL', 'Scopus', 'EID', '2-s2.0-777', '10.1/abc', 'record'])
})

test('--limit stops early; pubmed rows and bad external ids are counted, not written', async () => {
  const db = fakeDb({ reviews: [review(1, { source: 'pubmed' }), review(2, { external_id: '' }), review(3)], articles: [pa(1)] })
  const r = await runBackfill(db, { apply: true, limit: 2 })
  assert.equal(r.counts.checked, 2)
  assert.equal(r.counts.not_external, 1)
  assert.equal(r.counts.bad_record, 1)
  assert.equal(r.counts.updated, 0)
})

test('payloadOf matches the controller payload ids', () => {
  assert.equal(payloadOf({ source: 'scopus', external_id: '85123' }).articleId, 'SCOPUS:85123')
  assert.equal(payloadOf({ source: 'openalex', external_id: 'https://openalex.org/W42' }).articleId, 'OPENALEX:W42')
  assert.equal(payloadOf({ source: 'scopus', external_id: '1', entrez_date: new Date('2021-03-04T00:00:00Z') }).pubDate, '2021-03-04')
  assert.equal(planRow({ source: 'scopus', external_id: '1' }, {}).outcome, 'no_identity')
})

test('storedConflictJson / parseStoredConflict round trip, caps, and tolerate junk', () => {
  const java = [{ type: 'TITLE_YEAR_MATCH', matchedId: '39000001', detail: 'A PubMed article with a matching title...', title: 'T', journal: 'J', pubYear: '2024' }]
  const json = storedConflictJson('abc1001', 'Ada', 'accept', java, new Date('2026-01-01T00:00:00Z'))
  const p = parseStoredConflict(json)
  assert.deepEqual(p.matches[0], { source: 'PubMed', type: 'TITLE_YEAR_MATCH', id: '39000001', idLabel: 'PMID', doi: null, title: 'T', journal: 'J', pubYear: '2024', where: 'candidates', detail: 'A PubMed article with a matching title...' })
  assert.equal(parseStoredConflict(JSON.parse(json)).uid, 'abc1001') // already-parsed object
  assert.equal(storedConflictJson('a', 'b', 'accept', []), null)
  assert.equal(storedConflictJson('a', 'b', 'accept', undefined), null)
  assert.equal(JSON.parse(storedConflictJson('a', 'b', 'accept', Array.from({ length: 30 }, (_, i) => ({ type: 'TITLE_YEAR_MATCH', matchedId: String(i) })))).matches.length, 10)
  for (const junk of [null, undefined, '', 'not json', '{}', '{"matches":[]}', 42]) assert.equal(parseStoredConflict(junk), null)
})

test('matchIdentity covers PubMed, Scopus, OpenAlex, Crossref and rejection-memory keys', () => {
  assert.deepEqual(matchIdentity({ type: 'PMID_IN_CANDIDATES', matchedId: '12' }), { source: 'PubMed', id: '12', idLabel: 'PMID' })
  assert.deepEqual(matchIdentity({ type: 'TITLE_YEAR_MATCH_EXTERNAL', matchedId: 'SCOPUS:85001' }), { source: 'Scopus', id: '2-s2.0-85001', idLabel: 'EID' })
  assert.deepEqual(matchIdentity({ type: 'ALREADY_ADDED', matchedId: 'OPENALEX:W9' }), { source: 'OpenAlex', id: 'W9', idLabel: 'OpenAlex' })
  assert.deepEqual(matchIdentity({ type: 'DOI_MATCH_EXTERNAL', matchedId: 'CROSSREF:10.1/x' }), { source: 'Crossref', id: '10.1/x', idLabel: 'DOI' })
  assert.deepEqual(matchIdentity({ type: 'REJECTION_MEMORY', matchedId: 'DOI:10.2/y' }), { source: 'Existing record', id: '10.2/y', idLabel: 'DOI' })
  assert.equal(matchIdText({ id: '12', idLabel: 'PMID' }), 'PMID 12')
  assert.equal(matchWhereText({ where: 'record' }, 'Ada'), "Already in Ada's record")
  assert.equal(matchWhereText({ where: 'candidates' }, null), "In this person's PubMed candidates")
})

test('curatorConflictMessage strips the API flag from the check message', () => {
  assert.equal(curatorConflictMessage(MSG), 'Possible duplicate.')
  assert.equal(curatorConflictMessage('Possible duplicate (force=true).'), 'Possible duplicate.')
  assert.equal(curatorConflictMessage(''), 'Possible duplicate.')
  assert.equal(curatorConflictMessage("This article already exists in the person's record."), "This article already exists in the person's record.")
  assert.doesNotMatch(curatorConflictMessage('Retry with force=true to add anyway.'), /force/)
})
