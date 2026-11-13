// Smoke test for the bibliometric report v2 .docx (controllers/db/reports/bibliometricDocx.ts, 5h
// P4): builds the document for the three P1 row fixtures (dev, stale January 2026 iCite; NOT prod
// acceptance values) with stored peer cells, and checks the section order, the summary templates,
// the two PNG charts with alt text, and that no "n/a", NaN, undefined or 0.0th reaches the text.
// No database. `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import JSZip from 'jszip'

// The modules import their siblings without an extension, as Next resolves them.
registerHooks({
    resolve(spec, ctx, next) {
        try { return next(spec, ctx) } catch (e) {
            if (spec.startsWith('.') && !/\.[cm]?[jt]s$/.test(spec)) return next(spec + '.ts', ctx)
            throw e
        }
    },
})
const {
    buildBibliometricDocx, listedPmids, docxFileName, rankFromPersonTypes, shortAuthors, SCOPE_LINE, PEER_NOTE,
    missingV2Schema, REQUIRED_V2, toWorks, flagsFilled,
} = await import('../controllers/db/reports/bibliometricDocx.ts')

const FIX = JSON.parse(readFileSync(new URL('./fixtures/bibliometrics-v2-dev-2026-11-11.json', import.meta.url), 'utf8'))
const RUN = FIX.runDate

const ROLE_SETS = ['any', 'first_or_senior', 'first', 'senior']
/** The 8 stored cells; `set` maps "roleSet:N" to [avgTop, cohortRank, cohortM]. */
const cells8 = (rank, set = {}, eligible = 1) => ROLE_SETS.flatMap((rs) => [5, 10].map((n) => {
    const [avgTop, cohortRank, cohortM] = set[`${rs}:${n}`] ?? [null, null, null]
    return {
        personIdentifier: 'x', facultyRank: rank, cohortEligible: eligible, roleSet: rs, topN: n, ratedCount: 0, recentCount: 0,
        avgTop, cohortRank, cohortM, runDate: RUN, iciteLoadedAt: '2026-01-20',
    }
}))

const ISO = { 24586151: 'PLoS Pathog', 34341117: 'Proc Natl Acad Sci U S A', 24077180: 'Nat Chem Biol' }
const article = (pmid, authors) => ({ pmid, articleTitle: `Title of ${pmid}.`, authors: authors.map((name) => ({ name, wcm: false })) })

const PEOPLE = {
    alg2053: {
        person: { firstName: 'Alexandre', lastName: 'Gouzy', department: 'Microbiology and Immunology' },
        works: FIX.people.alg2053.map((w) => (ISO[w.pmid] ? { ...w, journalTitleISOabbreviation: ISO[w.pmid] } : w)),
        // dev P1 values: Any top 5 = 83.640, #244 of 660 (fixture-only)
        cells: cells8('Assistant Professor', { 'any:5': ['83.640', 244, 660], 'any:10': [null, null, 394] }),
        currentRank: 'Assistant Professor',
        eligibleNow: true,
    },
    cnathan: {
        person: { firstName: 'Carl', lastName: 'Nathan', department: 'Microbiology and Immunology' },
        works: FIX.people.cnathan,
        cells: null, // filled below from the recomputed averages, ranked
        currentRank: 'Full Professor',
        eligibleNow: true,
    },
    aah2003: {
        person: { firstName: 'Amna', lastName: 'Mirza', department: 'Pharmacology' },
        works: FIX.people.aah2003,
        cells: cells8('Instructor or Lecturer', {}, 0),
        currentRank: null,
        eligibleNow: false,
    },
}

// Nathan's cells carry PM's own averages (as STEP 5v2 would) and a rank in every cell.
const { peerTable } = await import('../controllers/db/reports/bibliometrics.ts')
{
    const recomputed = peerTable(PEOPLE.cnathan.works, [], { eligible: true })
    const set = {}
    recomputed.rows.forEach((r, i) => r.cells.forEach((c) => {
        if (c.average.avgThousandths !== null) set[`${r.roleSet}:${c.topN}`] = [(c.average.avgThousandths / 1000).toFixed(3), 2 + i, 336]
    }))
    PEOPLE.cnathan.cells = cells8('Full Professor', set)
}

const build = (uid) => {
    const p = PEOPLE[uid]
    return buildBibliometricDocx({
        uid, person: p.person, works: p.works, cells: p.cells, eligibleNow: p.eligibleNow, currentRank: p.currentRank,
        articles: new Map(listedPmids(p.works).map((pmid) => [pmid, article(pmid, ['Gouzy A', 'Poquet Y', 'Ehrt S', 'Neyrolles O'])])),
        runDate: RUN, iciteDate: '2026-01-20',
    })
}

const unzip = async (buf) => {
    const zip = await JSZip.loadAsync(buf)
    const xml = await zip.file('word/document.xml').async('string')
    const text = xml.replace(/<w:tab\/>/g, '\t').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/&quot;/g, '"')
    const media = Object.keys(zip.files).filter((f) => f.startsWith('word/media/') && !f.endsWith('/'))
    return { xml, text, media, zip }
}

const ORDER = ['Summary for reviewers', 'Key figures', 'Peer comparison', 'Authorship over time', 'Percentile distribution',
    'Most influential research articles', 'Reviews and other works', 'Recent work', 'Older work', 'Methods and sources']

const assertClean = (text) => {
    for (const bad of ['n/a', 'N/A', 'NaN', 'undefined', 'null', '0.0th', '[object']) assert.ok(!text.includes(bad), `"${bad}" in the document`)
}
const assertOrder = (sections) => {
    const idx = sections.map((s) => ORDER.indexOf(s))
    assert.ok(idx.every((i) => i >= 0), `unknown section in ${sections}`)
    assert.deepEqual(idx, [...idx].sort((a, b) => a - b), `sections out of spec order: ${sections}`)
}

test('Gouzy: header, S1/S2c/S3/S4/S5, peer rank, authorship chart only, no v1 values', async () => {
    const out = await build('alg2053')
    const { text, media, xml } = await unzip(out.buffer)
    assertOrder(out.sections)
    assert.deepEqual(out.sections, ['Summary for reviewers', 'Key figures', 'Peer comparison', 'Authorship over time',
        'Most influential research articles', 'Reviews and other works', 'Recent work', 'Methods and sources'])
    assert.deepEqual(out.fired, ['S1', 'S2c', 'S3', 'S4', 'S5'])
    assert.equal(out.peerShown, true)
    assert.deepEqual(out.mismatches, [])
    assert.ok(text.includes('Alexandre Gouzy · Microbiology and Immunology · Assistant Professor · alg2053'))
    assert.ok(text.includes(SCOPE_LINE))
    assert.ok(text.includes('Data from the ReCiter nightly run of 2026-11-11'))
    assert.ok(text.includes('about twice as often as'))
    assert.ok(text.includes('Among 660 WCM assistant professors with 5 or more rated research articles'))
    assert.ok(text.includes('#244 of 660 (top 37%)'))
    assert.ok(text.includes('Needs 10 rated'))
    assert.ok(text.includes('0 (2 too recent to rate)'))
    assert.ok(text.includes('First 4 · Senior 2 · Middle 3'))
    assert.ok(text.includes(PEER_NOTE))
    for (const v1 of ['73.7', '85.2', '62.2']) assert.ok(!text.includes(v1), `v1 value ${v1}`)
    assert.ok(!/\bLetter\b/.test(text.split('\nReviews and other works\n')[1].split('\nRecent work\n')[0]), 'a comment tagged Letter')
    assert.equal(media.length, 1, 'authorship chart only (7 rated < 20)')
    assert.ok(xml.includes('descr="Research articles by year and author role"'), 'alt text = chart title')
    assertClean(text)
})

test('Nathan: S1/S2a/S3, both charts, older work led by the most-cited paper', async () => {
    const out = await build('cnathan')
    const { text, media, xml } = await unzip(out.buffer)
    assertOrder(out.sections)
    assert.ok(out.sections.includes('Percentile distribution'))
    assert.ok(out.sections.includes('Older work'))
    assert.deepEqual(out.fired.slice(0, 3), ['S1', 'S2a', 'S3'])
    assert.ok(!out.fired.includes('S7'))
    assert.deepEqual(out.mismatches, [])
    assert.ok(text.includes('first- or senior-authored research articles'))
    assert.equal(media.length, 2)
    assert.ok(xml.includes('descr="NIH percentile of rated research articles"'))
    // Older work sorted by citations, highest first (fix 5): 216763 (610) before 727766 (7).
    const older = text.split('\nOlder work\n')[1].split('\nMethods and sources\n')[0]
    assert.ok(older.indexOf('PMID 216763') >= 0 && older.indexOf('PMID 216763') < (older.indexOf('PMID 727766') + 1 || Infinity))
    assertClean(text)
})

test('Mirza (not eligible on dev): S7 replaces the peer table, no ranks, distribution shown', async () => {
    const out = await build('aah2003')
    const { text, media } = await unzip(out.buffer)
    assertOrder(out.sections)
    assert.equal(out.peerShown, false)
    assert.equal(out.fired[out.fired.length - 1], 'S7')
    const peer = text.split('\nPeer comparison\n')[1].split('\nAuthorship over time\n')[0]
    assert.ok(peer.includes('Peer comparison covers WCM-employed full-time faculty with a faculty rank, so it is not shown.'))
    assert.ok(!/#\d+ of \d+/.test(text), 'no rank printed')
    assert.ok(!/Scopus h-index|h-index \(Scopus/.test(text))
    assert.ok(text.includes('about as often as'))
    assert.equal(media.length, 2)
    assertClean(text)
})

test('only external works: publications and recent work, h-index reason, no charts', async () => {
    const works = FIX.people.aah2003.filter((w) => w.pmid < 0)
    assert.ok(works.length > 0)
    const out = await buildBibliometricDocx({
        uid: 'ext0001', person: { firstName: 'Ex', lastName: 'Ternal' }, works, cells: [], eligibleNow: false, currentRank: null,
        articles: new Map(), runDate: RUN,
    })
    const { text, media } = await unzip(out.buffer)
    assert.equal(media.length, 0)
    assert.ok(text.includes('No PubMed works'))
    assert.ok(!out.sections.includes('Most influential research articles'))
    assert.ok(out.fired.includes('S6'))
    assertClean(text)
})

test('rank changed since the nightly: header names the rank used', async () => {
    const p = PEOPLE.alg2053
    const out = await buildBibliometricDocx({
        uid: 'alg2053', person: p.person, works: p.works, cells: p.cells, eligibleNow: true, currentRank: 'Associate Professor',
        articles: new Map(), runDate: RUN,
    })
    const { text } = await unzip(out.buffer)
    assert.ok(text.includes('Ranked as Assistant Professor, the rank held at the 2026-11-11 nightly run.'))
})

test('rankFromPersonTypes: weillfulltime plus a rank code; most senior when two', () => {
    assert.deepEqual(rankFromPersonTypes(['academic-faculty', 'academic-faculty-assistant', 'academic-faculty-weillfulltime']), { rank: 'Assistant Professor', eligible: true })
    assert.deepEqual(rankFromPersonTypes(['academic-faculty-instructor', 'academic-faculty-courtesy']), { rank: 'Instructor or Lecturer', eligible: false })
    assert.deepEqual(rankFromPersonTypes(['academic-faculty-weillfulltime']), { rank: null, eligible: false })
    assert.deepEqual(rankFromPersonTypes(['academic-faculty-associate', 'academic-faculty-fullprofessor', 'academic-faculty-weillfulltime']), { rank: 'Full Professor', eligible: true })
})

test('shortAuthors and file name', () => {
    const a = (...n) => n.map((name) => ({ name, wcm: false }))
    assert.equal(shortAuthors(a('Healy C', 'Gouzy A', 'Ehrt S')), 'Healy C, Gouzy A, Ehrt S')
    assert.equal(shortAuthors(a('Gouzy A', 'Poquet Y', 'Larrouy-Maumus G', 'Neyrolles O')), 'Gouzy A … Neyrolles O')
    assert.equal(shortAuthors([]), '')
    assert.equal(docxFileName('alg2053', '2026-11-11'), 'BibliometricAnalysis-alg2053-2026-11-11.docx')
})

test('v3.11 column probe: every required column, else the 503 path', () => {
    const all = Object.entries(REQUIRED_V2).flatMap(([table, cols]) => cols.map((column) => ({ table, column })))
    assert.deepEqual(missingV2Schema(all), [])
    assert.deepEqual(missingV2Schema(all.map((r) => ({ table: r.table.toUpperCase(), column: r.column.toLowerCase() }))), [])
    const noPeer = all.filter((r) => r.table !== 'analysis_summary_person_peer')
    assert.equal(missingV2Schema(noPeer).length, 12)
    assert.deepEqual(missingV2Schema(all.filter((r) => r.column !== 'ratedV2')), ['analysis_summary_article.ratedV2'])
})

test('toWorks parses driver rows; flagsFilled is false while the old procedure left the flags NULL', () => {
    const rows = [
        { pmid: '24586151', pubTypeCounted: 1, pctExact: '89.60', relativeCitationRatioNIH: 3.88, researchArticleV2: 1, ratedV2: 1, recentV2: 0, authorRoleV2: 'first' },
        { pmid: '24586151', pubTypeCounted: 1, pctExact: '89.60', researchArticleV2: 1, ratedV2: 1, recentV2: 0 },
        { pmid: '-5', pubTypeCounted: null, pctExact: null, researchArticleV2: '0', ratedV2: '0', recentV2: '1' },
    ]
    const ws = toWorks(rows)
    assert.equal(ws.length, 2)
    assert.equal(ws[0].pmid, 24586151)
    assert.equal(ws[0].pctExact, '89.60', 'DECIMAL kept as a string')
    assert.equal(ws[1].recentV2, 1)
    assert.equal(flagsFilled(ws), true)
    assert.equal(flagsFilled(toWorks([{ pmid: 1, pubTypeCounted: 1, researchArticleV2: null, ratedV2: null, recentV2: null }])), false)
    // An uncounted row (erratum) or an external row (6v2) with NULL flags does not block the report.
    assert.equal(flagsFilled(toWorks([...rows, { pmid: 2, pubTypeCounted: 0, researchArticleV2: null, ratedV2: null, recentV2: null }])), true)
    assert.equal(flagsFilled(toWorks([...rows, { pmid: -9, sourceType: 'SCOPUS', pubTypeCounted: 1, researchArticleV2: null, ratedV2: null, recentV2: null }])), true)
})
