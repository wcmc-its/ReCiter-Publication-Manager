// Smoke test for the 5h bibliometric .docx (controllers/db/reports/bibliometricDocx.ts): builds
// documents from fixture rows and checks the zip has the three native charts, the section headings
// and no "undefined" / "NaN" text. Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import JSZip from 'jszip'

// The module imports its siblings without an extension, as Next resolves them.
registerHooks({
  resolve(spec, ctx, next) {
    try { return next(spec, ctx) } catch (e) {
      if (spec.startsWith('.') && !/\.[cm]?[jt]s$/.test(spec)) return next(spec + '.ts', ctx)
      throw e
    }
  },
})
const { buildBibliometricDocx, listedPmids, docxFileName, PUBMED_LINK_PMIDS } = await import('../controllers/db/reports/bibliometricDocx.ts')

const RUN = '2026-11-11'
let next = 30000000
const work = (o = {}) => ({
  pmid: next++, sourceType: 'PUBMED', authorPosition: null, pubType: 'Academic Article', pubTypeGroup: 'journal',
  pubTypeCounted: 1, pubDate: '2015-03-01', articleYear: 2015, datePublicationAddedToEntrez: '2015-03-02',
  publicationTypeNIH: 'Research Article', journalTitleVerbose: 'Journal of Tests', journalImpactScore1: 2.5,
  citationCountNIH: 10, citationCountScopus: 12, relativeCitationRatioNIH: 1.25, percentileNIH: 62.4,
  peerReviewed: 1, ...o,
})

const fixtureWorks = () => {
  const ws = []
  for (let i = 0; i < 40; i++) {
    const y = 1975 + i
    ws.push(work({
      authorPosition: i % 3 === 0 ? 'first' : i % 3 === 1 ? 'last' : null,
      pubDate: `${y}-06-01`, articleYear: y, datePublicationAddedToEntrez: `${Math.max(y, 1990)}-06-02`,
      citationCountNIH: 50 - i, percentileNIH: y < 1980 ? null : 30 + i * 1.5, relativeCitationRatioNIH: y < 1980 ? null : 0.5 + i / 10,
      pubType: i % 5 === 0 ? 'Review' : 'Academic Article', publicationTypeNIH: i % 5 === 0 ? 'Other' : 'Research Article',
    }))
  }
  // recent, no percentile yet
  ws.push(work({ authorPosition: 'last', pubDate: '2026-05-01', articleYear: 2026, datePublicationAddedToEntrez: '2026-05-02', percentileNIH: null, relativeCitationRatioNIH: null, citationCountNIH: 1 }))
  // conference paper, a book chapter, a preprint, an erratum (not counted)
  ws.push(work({ pubType: 'Conference Paper', pubTypeGroup: 'conf', peerReviewed: 1, publicationTypeNIH: null }))
  ws.push(work({ pubType: 'Book Chapter', pubTypeGroup: 'book', peerReviewed: 0, publicationTypeNIH: null, journalTitleVerbose: null, publisher: 'Springer' }))
  ws.push(work({ pubType: 'Preprint', pubTypeGroup: 'other', peerReviewed: 0, publicationTypeNIH: null }))
  ws.push(work({ pubType: 'Erratum', pubTypeGroup: null, pubTypeCounted: 0, citationCountNIH: 0 }))
  // external rows: never in citation metrics, position not set
  ws.push(work({ pmid: -101, sourceType: 'SCOPUS', citationCountNIH: 999, percentileNIH: 99, pubDate: '2024-01-01', articleYear: 2024 }))
  ws.push(work({ pmid: -102, sourceType: 'OPENALEX', citationCountNIH: null, percentileNIH: null, pubDate: '2025-01-01', articleYear: 2025 }))
  return ws
}

const ranked = {
  personIdentifier: 'abc1234', nameFirst: 'Ada', nameLast: 'Tester', facultyRank: 'Associate', department: 'Medicine',
  hindexNIH: 21, h5indexNIH: 3, hindexScopus: 22, h5indexScopus: 4, countAll: 28, countFirst: 9, countSenior: 9,
  top5PercentileFirstSenior: 87.25, top10PercentileFirstSenior: 80.1, top5RankFirstSenior: 12, top10RankFirstSenior: 15,
  top5DenominatorFirstSenior: 300, top10DenominatorFirstSenior: 200,
  top5PercentileSenior: 88, top5RankSenior: 5, top5DenominatorSenior: 250,
  top5PercentileFirst: 70, top5RankFirst: 40, top5DenominatorFirst: 260,
  top5PercentileAll: 90, top10PercentileAll: 85, top5RankAll: 3, top10RankAll: 4, top5DenominatorAll: 400, top10DenominatorAll: 350,
}

const articlesFor = (works) => new Map(listedPmids(works, RUN).map((pmid) => [pmid, {
  pmid, articleTitle: `Paper ${pmid} on <i>in vitro</i> tests`, journalTitleVerbose: 'Journal of Tests', articleYear: 2015,
  volume: '1', pages: '1-2', doi: `10.1/${pmid}`, authors: [{ name: 'Tester A', wcm: true }, { name: 'Other B', wcm: false }],
}]))

const unzip = async (buffer) => {
  const zip = await JSZip.loadAsync(buffer)
  const read = (p) => zip.file(p)?.async('string')
  return { zip, names: Object.keys(zip.files), read }
}
// Visible text of a WordprocessingML part.
const textOf = (xml) => [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('')

test('ranked person: three native charts, every section, no undefined/NaN', async () => {
  const works = fixtureWorks()
  const out = await buildBibliometricDocx({
    uid: 'abc1234', person: { firstName: 'Ada', lastName: 'Tester', department: 'Medicine' }, ranked, works,
    articles: articlesFor(works), hasPeerReviewed: true, runDate: RUN, dataAsOf: '2026-11-10',
  })
  assert.equal(out.peerShown, true)
  assert.equal(out.hSource, 'stored')
  assert.equal(out.external, 2)
  assert.equal(out.counted, works.length - 1) // the erratum is not counted
  const { names, read } = await unzip(out.buffer)
  for (const n of ['word/charts/chart1.xml', 'word/charts/chart2.xml', 'word/charts/chart3.xml']) assert.ok(names.includes(n), `missing ${n}`)
  assert.ok(!names.includes('word/charts/chart4.xml'))
  assert.ok(names.some((n) => /^word\/embeddings\/.*\.xlsx$/.test(n)), 'charts carry an embedded workbook')
  const doc = await read('word/document.xml')
  const body = textOf(doc)
  for (const h of ['Bibliometric analysis: Ada Tester', 'Summary', 'Peer comparison', 'Publications by year and type', 'Publication types',
    'Authorship roles', 'Citation impact', 'Most cited', 'Most influential research articles', 'First or last author',
    'Any author position', 'Journals', 'Recent articles', 'Older articles', 'Works from other sources', 'Methods and sources']) {
    assert.ok(body.includes(h), `missing "${h}"`)
  }
  assert.ok(body.includes('21 (h5-index 3)'), 'stored h-index wins')
  assert.ok(body.includes('87.2'), 'peer percentile rounded as MySQL does')
  assert.ok(body.includes('Not set 2'), 'external rows are position not set')
  assert.ok(body.includes('Scopus 1') && body.includes('Openalex 1'))
  assert.doesNotMatch(body, /undefined|NaN|\[object Object\]/)
  for (const n of names.filter((x) => x.endsWith('.xml'))) assert.doesNotMatch(await read(n), />(?:undefined|NaN)</, n)
  const footer = textOf(await read(names.find((n) => /^word\/footer\d*\.xml$/.test(n))))
  assert.ok(footer.includes(`ReCiter Publication Manager · ${RUN} · page`))
  // Chart 1 is stacked, with the 30-year collapse (1975..2026 is 52 years).
  const c1 = await read('word/charts/chart1.xml')
  assert.match(c1, /<c:grouping val="stacked"\/>/)
  assert.ok(c1.includes('Before 1997'))
  // External rows never reach the citation metrics: total = sum of PubMed counted NIH citations.
  const pubmedCites = works.filter((w) => w.pmid > 0 && w.pubTypeCounted !== 0).reduce((t, w) => t + (w.citationCountNIH || 0), 0)
  assert.ok(body.includes(pubmedCites.toLocaleString('en-US')))
  assert.equal(docxFileName('abc1234', RUN), 'BibliometricAnalysis-abc1234-2026-11-11.docx')
})

test('unranked person without v3.10: computed h-index, no peer section, no peer-review columns', async () => {
  const works = fixtureWorks().map(({ peerReviewed, ...w }) => w)
  const out = await buildBibliometricDocx({
    uid: 'xyz9', person: { firstName: 'Bo', lastName: 'Unranked' }, ranked: null, works,
    articles: articlesFor(works), hasPeerReviewed: false, runDate: RUN,
  })
  assert.equal(out.peerShown, false)
  assert.equal(out.hSource, 'computed')
  const { names, read } = await unzip(out.buffer)
  assert.ok(names.includes('word/charts/chart3.xml'))
  const body = textOf(await read('word/document.xml'))
  assert.ok(body.includes('covers WCM-employed full-time faculty with a faculty rank only'))
  assert.ok(!body.includes('Peer reviewed'))
  assert.doesNotMatch(body, /undefined|NaN/)
})

test('a person with only external works: no charts that need data, still a valid document', async () => {
  const works = [
    work({ pmid: -1, sourceType: 'SCOPUS', percentileNIH: null, publicationTypeNIH: null }),
    work({ pmid: -2, sourceType: 'CROSSREF', pubDate: null, articleYear: null, percentileNIH: null, publicationTypeNIH: null }),
  ]
  const out = await buildBibliometricDocx({
    uid: 'ext1', person: { firstName: 'Ex', lastName: 'Ternal' }, ranked: null, works, articles: new Map(), hasPeerReviewed: true, runDate: RUN,
  })
  const { names, read } = await unzip(out.buffer)
  assert.ok(names.includes('word/charts/chart1.xml') && names.includes('word/charts/chart2.xml'))
  assert.ok(!names.includes('word/charts/chart3.xml'), 'no percentile chart without research articles')
  const body = textOf(await read('word/document.xml'))
  assert.ok(body.includes('No research article has an NIH percentile yet.'))
  assert.ok(body.includes('h-index (NIH iCite)0 (h5-index 0)'))
  assert.ok(body.includes('1 publication has no year'))
  assert.doesNotMatch(body, /undefined|NaN/)
})

test('PubMed search links split at 220 PMIDs', async () => {
  const works = []
  for (let i = 0; i < PUBMED_LINK_PMIDS + 5; i++) works.push(work({ authorPosition: 'last' }))
  const out = await buildBibliometricDocx({
    uid: 'many', person: { firstName: 'M', lastName: 'Any' }, ranked: null, works, articles: new Map(), hasPeerReviewed: true, runDate: RUN,
  })
  const { read } = await unzip(out.buffer)
  const rels = await read('word/_rels/document.xml.rels')
  const links = [...rels.matchAll(/Target="(https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/\?term=[^"]+)"/g)].map((m) => m[1])
  assert.ok(links.length >= 4, `expected list 1 and 2 for all and senior, got ${links.length}`)
  for (const l of links) assert.ok(l.split('+').length <= PUBMED_LINK_PMIDS)
})
