// Unit tests for src/lib/externalDupCheck.ts (the add-time duplicate check, plan 3b-3e) and the
// row shaping it leans on in src/lib/externalRecordShape.ts. Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'

// These modules import their siblings without an extension, as Next resolves them; let node do
// the same for this test run.
registerHooks({
  resolve(spec, ctx, next) {
    try { return next(spec, ctx) } catch (e) {
      if (spec.startsWith('.') && !/\.[cm]?[jt]s$/.test(spec)) return next(spec + '.ts', ctx)
      throw e
    }
  },
})
const { checkExternalDup, conflictBody, matchRejectionMemory, orderedPair } = await import('../src/lib/externalDupCheck.ts')
const { recordFromInput, rejectionKeysOf, titleYearKey, normDoi, buildByline, normalizeAuthors, apiRecordOf, sourceIdsOf } =
  await import('../src/lib/externalRecordShape.ts')

const cand = (extra = {}) => ({ article_id: 'CROSSREF:10.1/new', doi: '10.1/new', title: 'A wholly new paper on livers', pub_date: '2024-02-01', ...extra })
const ext = (id, articleId, status, extra = {}) => ({ id, article_id: articleId, source_type: articleId.split(':')[0], status, title: 'Other', pub_date: '2019', ...extra })
const pa = (pmid, extra = {}) => ({ pmid, articleTitle: 'PubMed paper', publicationDateStandardized: '2018-01-01', journalTitleVerbose: 'J', ...extra })
const types = (r) => r.matches.map((m) => m.type)

test('OK when nothing matches', () => {
  assert.deepEqual(checkExternalDup(cand(), { existing: [ext(1, 'SCOPUS:1', 'ACCEPTED')], candidates: [pa(1)] }), { level: 'OK', matches: [] })
  assert.equal(conflictBody({ level: 'OK', matches: [] }), null)
})

test('BLOCKED: GoldStandard known and rejected PMIDs', () => {
  const r = checkExternalDup(cand({ pmid: 42 }), { knownPmids: [42], rejectedPmids: new Set([42]) })
  assert.equal(r.level, 'BLOCKED')
  assert.deepEqual(types(r), ['PMID_IN_GOLD_STANDARD', 'PMID_REJECTED_IN_GOLD_STANDARD'])
})

test('BLOCKED: PMID or DOI in the person_article candidates; title+year there only warns', () => {
  assert.deepEqual(types(checkExternalDup(cand({ pmid: 7 }), { candidates: [pa(7)] })), ['PMID_IN_CANDIDATES'])
  const d = checkExternalDup(cand({ doi: 'https://doi.org/10.1/NEW' }), { candidates: [pa(8, { doi: '10.1/new' })] })
  assert.deepEqual([d.level, ...types(d)], ['BLOCKED', 'DOI_MATCH'])
  assert.equal(d.matches[0].matchedId, '8')
  const w = checkExternalDup(cand(), { candidates: [pa(9, { articleTitle: 'A wholly new paper on livers.', publicationDateStandardized: '2024-06-01' })] })
  assert.deepEqual([w.level, ...types(w)], ['WARNING', 'TITLE_YEAR_MATCH'])
})

test('BLOCKED: an existing live record by article_id, PMID, DOI or source id', () => {
  const same = checkExternalDup(cand(), { existing: [ext(1, 'CROSSREF:10.1/new', 'PENDING')] })
  assert.deepEqual(types(same), ['ALREADY_ADDED'])
  assert.equal(same.matches[0].recordId, 1)
  assert.deepEqual(types(checkExternalDup(cand({ pmid: 5 }), { existing: [ext(2, 'SCOPUS:2', 'ACCEPTED', { pmid: 5 })] })), ['PMID_MATCH_EXTERNAL'])
  assert.deepEqual(types(checkExternalDup(cand(), { existing: [ext(3, 'OPENALEX:W3', 'SUPERSEDED', { doi: 'doi:10.1/NEW' })] })), ['DOI_MATCH_EXTERNAL'])
  const src = checkExternalDup(cand({ article_id: 'CROSSREF:10.1/x', doi: null, openalex_id: 'https://openalex.org/W77' }), { existing: [ext(4, 'OPENALEX:W77', 'ACCEPTED')] })
  assert.deepEqual([src.level, ...types(src)], ['BLOCKED', 'ALREADY_ADDED'])
  assert.match(src.matches[0].detail, /same source id/)
})

test('a merged record still blocks its own article_id; rejected/removed rows do not', () => {
  assert.equal(checkExternalDup(cand(), { existing: [ext(1, 'CROSSREF:10.1/new', 'MERGED')] }).level, 'BLOCKED')
  for (const s of ['REJECTED', 'REMOVED']) {
    assert.equal(checkExternalDup(cand(), { existing: [ext(1, 'CROSSREF:10.1/new', s), ext(2, 'SCOPUS:9', s, { doi: '10.1/new' })] }).level, 'OK', s)
  }
})

test('WARNING: title + year >= 85% against a live external record, never across years', () => {
  const e = ext(5, 'SCOPUS:5', 'ACCEPTED', { title: 'A wholly new paper on livers', pub_date: '2024' })
  assert.deepEqual(types(checkExternalDup(cand(), { existing: [e] })), ['TITLE_YEAR_MATCH_EXTERNAL'])
  assert.equal(checkExternalDup(cand(), { existing: [{ ...e, pub_date: '2023' }] }).level, 'OK')
  assert.equal(checkExternalDup(cand(), { existing: [{ ...e, status: 'REMOVED' }] }).level, 'OK')
})

test('blocked results carry the warnings too, blocked first (as Java)', () => {
  const r = checkExternalDup(cand({ pmid: 1 }), {
    knownPmids: [1],
    candidates: [pa(2, { articleTitle: 'A wholly new paper on livers', publicationDateStandardized: '2024' })],
  })
  assert.deepEqual(types(r), ['PMID_IN_GOLD_STANDARD', 'TITLE_YEAR_MATCH'])
})

test('409 body matches ExternalArticleController.conflictBody', () => {
  const b = conflictBody(checkExternalDup(cand({ pmid: 1 }), { knownPmids: [1] }))
  assert.deepEqual(Object.keys(b), ['status', 'message', 'matches'])
  assert.equal(b.status, 'BLOCKED')
  assert.equal(b.message, "This article already exists in the person's record.")
  for (const k of ['type', 'matchedId', 'detail', 'title', 'journal', 'pubYear']) assert.ok(k in b.matches[0], k)
  const w = conflictBody({ level: 'WARNING', matches: [] })
  assert.equal(w.message, 'Possible duplicate. Retry with force=true to add anyway.')
})

test('rejection memory warns with who and when', () => {
  const removed = { id: 11, article_id: 'SCOPUS:11', source_type: 'SCOPUS', status: 'REMOVED', title: 'T', pub_date: '2024' }
  const rows = [{ key_type: 'DOI', key_value: '10.1/new', record_id: 11, reason: 'REMOVED', rejected_by: 'abc1234', rejected_at: '2026-11-02T15:00:00Z' }]
  const r = checkExternalDup(cand(), { existing: [removed], rejections: rows })
  assert.deepEqual([r.level, ...types(r)], ['WARNING', 'REJECTION_MEMORY'])
  assert.equal(r.matches[0].detail, 'Removed by abc1234 on 2026-11-02. Add anyway to restore it.')
  assert.equal(r.matches[0].matchedId, 'SCOPUS:11')
  assert.equal(r.matches[0].recordId, 11)
})

test('rejection memory precedence: the highest key both carry decides', () => {
  const ty = titleYearKey('Same title', '2020')
  const mem = [
    { key_type: 'DOI', key_value: '10.1/a', record_id: 1, reason: 'REJECTED' },
    { key_type: 'TITLE_YEAR', key_value: ty, record_id: 1, reason: 'REJECTED' },
  ]
  // Different DOIs: different works, even with the same title and year.
  assert.equal(matchRejectionMemory(rejectionKeysOf({ doi: '10.1/b', title: 'Same title', pub_date: '2020' }), mem).length, 0)
  // Same DOI: match.
  assert.equal(matchRejectionMemory(rejectionKeysOf({ doi: 'https://doi.org/10.1/A' }), mem).length, 1)
  // No DOI on the candidate: falls to title+year.
  assert.equal(matchRejectionMemory(rejectionKeysOf({ title: 'Same title!', pub_date: '2020-05' }), mem).length, 1)
  // Put-code outranks source id.
  const put = [{ key_type: 'ORCID_PUTCODE', key_value: '99', record_id: 2, reason: 'REMOVED' }, { key_type: 'SOURCE_ID', key_value: 'SCOPUS:5', record_id: 2, reason: 'REMOVED' }]
  assert.equal(matchRejectionMemory(rejectionKeysOf({ orcid_put_code: '98', article_id: 'SCOPUS:5' }), put).length, 0)
  assert.equal(matchRejectionMemory(rejectionKeysOf({ article_id: 'SCOPUS:5' }), put).length, 1)
})

test('rejection keys and source ids', () => {
  assert.deepEqual(rejectionKeysOf({ article_id: 'OPENALEX:https://openalex.org/W1', doi: 'DOI: 10.5/X', orcid_put_code: '12', scopus_eid: '2-s2.0-9', title: 'T', pub_date: '2021' }).map((k) => k.key_type + '=' + k.key_value), [
    'DOI=10.5/x', 'ORCID_PUTCODE=12', 'SOURCE_ID=OPENALEX:W1', 'SOURCE_ID=SCOPUS:2-s2.0-9', 'TITLE_YEAR=' + titleYearKey('T', '2021'),
  ])
  assert.deepEqual(sourceIdsOf({ article_id: 'CROSSREF:10.1/x' }), [])
  assert.deepEqual(sourceIdsOf({ article_id: 'MANUAL:abc' }), [])
})

test('title_year_key: the pinned vector the ReCiterDB sync must reproduce', () => {
  // python: hashlib.sha1(f"{norm}|{year}".encode()).hexdigest(), norm = lower, [^a-z0-9 ] -> ' ', collapse spaces, strip
  assert.equal(titleYearKey('Nail-unit melanoma: in ADULTS.', '2020-03-01'), 'a6fb2766c36f938c3b1b208608ef24bbb989e37b')
  assert.equal(titleYearKey('', '2020'), null)
  assert.equal(titleYearKey('Title', null), null)
  assert.equal(normDoi(' https://dx.doi.org/10.1/AB '), '10.1/ab')
  assert.equal(normDoi(''), null)
})

test('verdict pairs are ordered by code point, not collation', () => {
  // unicode_ci and localeCompare put '_' before '1'; the table's CHECK compares bytes.
  assert.deepEqual(orderedPair('EXT:CROSSREF:10.1/a_b', 'EXT:CROSSREF:10.1/a1b'), ['EXT:CROSSREF:10.1/a1b', 'EXT:CROSSREF:10.1/a_b'])
  assert.deepEqual(orderedPair('PMID:2', 'EXT:SCOPUS:1'), ['EXT:SCOPUS:1', 'PMID:2'])
  assert.throws(() => orderedPair('PMID:1', 'PMID:1'))
})

test('byline: person wrapped, cut at BYLINE_MAX keeping the person', () => {
  const a = normalizeAuthors(['Gary A. Koretzky', { given: 'Ann', surname: 'Lee' }, { given: 'Bo', family: 'Chen' }, 'John Smith Jr.'])
  assert.equal(buildByline(a, 2), 'Koretzky GA, ((Lee A)), Chen B, Smith J')
  assert.equal(buildByline(a, null), 'Koretzky GA, Lee A, Chen B, Smith J')
  assert.equal(buildByline([], 1), null)
  const many = Array.from({ length: 300 }, (_, i) => ({ given: 'Ann', surname: 'Author' + i }))
  const b = buildByline(many, 250)
  assert.ok(b.length <= 1000)
  assert.match(b, /, \.\.\., \(\(Author249 A\)\), et al\.$/)
})

test('recordFromInput maps today\'s add body and the type maps', () => {
  const r = recordFromInput({
    articleId: 'OPENALEX:W5', sourceType: 'OPENALEX', doi: '10.1/x', title: 'Abstract', pubDate: '2025-06',
    journalOrVenue: 'Blood', publicationType: 'conference-abstract', authors: ['Ann Lee', 'Bo Chen'], targetAuthorIndex: 2,
    method: 'dropdown-search', provenance: 'ADD_SEARCH',
  })
  assert.equal(r.pub_type, 'Conference Abstract')
  assert.equal(r.source_pub_type, 'conference-abstract')
  assert.equal(r.container_title, 'Blood')
  assert.equal(r.date_precision, 'MONTH')
  assert.equal(r.byline, 'Lee A, ((Chen B))')
  assert.deepEqual([r.target_author_index, r.author_count, r.peer_reviewed, r.peer_reviewed_by_hand], [2, 2, null, 0])
  assert.equal(r.title_year_key, titleYearKey('Abstract', '2025'))
  const err = recordFromInput({ articleId: 'SCOPUS:1', sourceType: 'SCOPUS', publicationType: 'Erratum' })
  assert.deepEqual([err.pub_type, err.type_notice], [null, 'erratum'])
  const man = recordFromInput({ sourceType: 'MANUAL', title: 'Mine', pubType: 'Book', peerReviewed: true, targetAuthorIndex: 3, authors: ['A B'] })
  assert.match(man.article_id, /^MANUAL:[0-9a-f-]{36}$/)
  assert.deepEqual([man.pub_type, man.peer_reviewed, man.peer_reviewed_by_hand, man.target_author_index], ['Book', 1, 1, null])
  assert.throws(() => recordFromInput({ articleId: 'SCOPUS:1', sourceType: 'OPENALEX' }), /articleId/)
  assert.throws(() => recordFromInput({ articleId: 'WORLDCAT:1' }), /sourceType/)
})

test('apiRecordOf keeps the ExternalArticle field names', () => {
  const a = apiRecordOf({
    id: '3', uid: 'abc1234', article_id: 'SCOPUS:1', source_type: 'SCOPUS', status: 'SUPERSEDED', superseded_by_pmid: '99',
    container_title: 'J', pub_date: '2020', source_pub_type: 'Article', authors_json: '[{"given":"Ann","surname":"Lee"}]',
    added_at: new Date('2026-01-01T00:00:00Z'), added_by: 'x', method: 'm', peer_reviewed: 0,
  })
  assert.deepEqual(
    [a.id, a.articleId, a.sourceType, a.suppressed, a.supersededByPmid, a.journalOrVenue, a.publicationType, a.authors, a.dateAdded, a.peerReviewed],
    [3, 'SCOPUS:1', 'SCOPUS', true, 99, 'J', 'Article', ['Ann Lee'], '2026-01-01T00:00:00.000Z', false])
  assert.equal(apiRecordOf({ status: 'ACCEPTED' }).suppressed, false)
})

test('apiRecordOf: the 3g import columns map when present and are null before the DDL adds them', () => {
  const a = apiRecordOf({ status: 'PENDING', source_detail: 'Europe PMC', affiliation_flag: 'UNFAMILIAR', slot_affiliations_json: '["Mayo Clinic"]' })
  assert.deepEqual([a.sourceDetail, a.affiliationFlag, a.slotAffiliations], ['Europe PMC', 'UNFAMILIAR', ['Mayo Clinic']])
  const b = apiRecordOf({ status: 'PENDING' })
  assert.deepEqual([b.sourceDetail, b.affiliationFlag, b.slotAffiliations], [null, null, null])
})
