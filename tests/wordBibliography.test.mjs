// Unit tests for the 5g Word (.docx) bibliography helpers: the no-filter guard, the selection SQL,
// author merging and truncation, citation segments and grouping. Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
    hasReportFilter, buildSelection, mergeAuthors, truncateAuthors, inlineSegments, citationSegments,
    groupArticles, yearOf, wordLimit, WORD_LIMIT_CEILING,
} from '../controllers/db/reports/wordBibliography.ts'
import { authorPositionSql, sourceSql } from '../controllers/db/reports/reportFilterSql.ts'

const text = (segs) => segs.map((s) => s.text).join('')

test('hasReportFilter: empty filters (the page initial state) are refused', () => {
    assert.equal(hasReportFilter(undefined), false)
    assert.equal(hasReportFilter({}), false)
    assert.equal(hasReportFilter({
        personIdentifers: [], orgUnits: [], institutions: [], personTypes: [], authorPosition: [], sourceTypes: [],
        datePublicationAddedToEntrezLowerBound: '', datePublicationAddedToEntrezUpperBound: '',
        publicationTypeCanonical: [], journalTitleVerbose: [], journalImpactScoreLowerBound: '', journalImpactScoreUpperBound: '',
    }), false)
    assert.equal(hasReportFilter({ personIdentifers: ['paa2013'] }), true)
    assert.equal(hasReportFilter({ datePublicationAddedToEntrezLowerBound: '2024-01-01' }), true)
    assert.equal(hasReportFilter({ sourceTypes: ['SCOPUS'] }), true)
    assert.equal(hasReportFilter({ journalImpactScoreLowerBound: 2 }), true)
})

test('buildSelection: author filters join person, values are replacements', () => {
    const f = { personIdentifers: ['abc1234'], orgUnits: ["Medicine'; drop"], authorPosition: ['first', 'middle'] }
    const s = buildSelection(f, { authorClause: authorPositionSql('asu', f.authorPosition) })
    assert.match(s.from, /INNER JOIN person p ON p\.personIdentifier = asu\.personIdentifier/)
    assert.doesNotMatch(s.from, /person_person_type/)
    assert.match(s.where, /asu\.personIdentifier IN \(:personIdentifiers\)/)
    assert.match(s.where, /p\.primaryOrganizationalUnit LIKE :orgLike0/)
    assert.match(s.where, /asu\.authorPosition IN \('first'\) OR asu\.authorPosition IS NULL/)
    assert.doesNotMatch(s.where, /drop/)
    assert.deepEqual(s.replacements.personIdentifiers, ['abc1234'])
    assert.equal(s.replacements.orgLike0, "%Medicine'; drop%")
})

test('buildSelection: article-only filters skip the person join; external toggle and source', () => {
    const f = { publicationTypeCanonical: ['Review'], datePublicationAddedToEntrezLowerBound: '2020-01-01', journalImpactScoreUpperBound: 5 }
    const s = buildSelection(f, { sourceClause: sourceSql('asa', ['PUBMED', 'SCOPUS'], true), includeExternal: false })
    assert.doesNotMatch(s.from, /person p/)
    assert.match(s.where, /asa\.publicationTypeCanonical IN \(:types\)/)
    assert.match(s.where, /asa\.datePublicationAddedToEntrez > :dateLower/)
    assert.match(s.where, /asa\.journalImpactScore1 < :impactUpper/)
    assert.match(s.where, /COALESCE\(asa\.source_type, 'PUBMED'\)/)
    assert.match(s.where, /asa\.pmid > 0/)
    const withPt = buildSelection({ personTypes: ['academic-faculty'] })
    assert.match(withPt.from, /person_person_type ppt/)
})

test('mergeAuthors: one list, every WCM author from any row marked', () => {
    const merged = mergeAuthors([
        'Pasmantier MW, ((Coleman M)), Silver RT',
        '((Pasmantier MW)), Coleman M, Silver RT',
    ])
    assert.deepEqual(merged, [
        { name: 'Pasmantier MW', wcm: true },
        { name: 'Coleman M', wcm: true },
        { name: 'Silver RT', wcm: false },
    ])
    assert.deepEqual(mergeAuthors([null, '']), [])
})

test('truncateAuthors: the RTF rule (8+ -> first six, ..., last)', () => {
    const seven = Array.from({ length: 7 }, (_, i) => ({ name: `A${i}`, wcm: false }))
    assert.equal(truncateAuthors(seven).length, 7)
    const nine = Array.from({ length: 9 }, (_, i) => ({ name: `A${i}`, wcm: false }))
    const t = truncateAuthors(nine)
    assert.equal(t.length, 8)
    assert.equal(t[6], 'ellipsis')
    assert.equal(t[7].name, 'A8')
})

test('inlineSegments: keeps italics/sub/sup, drops other tags, decodes entities', () => {
    const segs = inlineSegments('Role of <i>KIAA0319L</i> in CO<sub>2</sub> &amp; <a href="x">more</a>')
    assert.equal(text(segs), 'Role of KIAA0319L in CO2 & more')
    assert.equal(segs.find((s) => s.text === 'KIAA0319L').italics, true)
    assert.equal(segs.find((s) => s.text === '2').sub, true)
    // <i> inside an italic journal name flips back to roman
    const j = inlineSegments('Journal of <i>E. coli</i>', { italics: true })
    assert.equal(j[0].italics, true)
    assert.equal(j[1].italics, false)
})

test('citationSegments: RTF order, bold WCM authors, PMID/PMCID/DOI links', () => {
    const segs = citationSegments({
        pmid: 12345, pmcid: 'PMC999', doi: '10.1000/xyz', articleTitle: 'A study.', journalTitleVerbose: 'J Test',
        articleYear: 2024, volume: '12', pages: '1-9',
        authors: [{ name: 'Smith J', wcm: false }, { name: 'Doe A', wcm: true }],
    })
    assert.equal(text(segs), 'Smith J, Doe A. A study. J Test. 2024;12:1-9. PMID: 12345. PMCID: PMC999. doi: 10.1000/xyz.')
    assert.equal(segs.find((s) => s.text === 'Doe A').bold, true)
    assert.equal(segs.find((s) => s.text === 'Smith J').bold, undefined)
    assert.equal(segs.find((s) => s.text === 'J Test').italics, true)
    assert.equal(segs.find((s) => s.text === '12345').link, 'https://pubmed.ncbi.nlm.nih.gov/12345/')
    assert.equal(segs.find((s) => s.text === '10.1000/xyz').link, 'https://doi.org/10.1000/xyz')
})

test('citationSegments: an external work (negative pmid) has no PMID', () => {
    const segs = citationSegments({
        pmid: -42, doi: 'https://doi.org/10.5/abc', articleTitle: 'Book chapter', journalTitleVerbose: '', articleYear: 0,
        publicationDateDisplay: '2023 May', authors: [{ name: 'Doe A', wcm: true }],
    })
    assert.equal(text(segs), 'Doe A. Book chapter. 2023. doi: 10.5/abc.')
})

test('groupArticles: year (newest first), type (CV order), person', () => {
    const a = (pmid, year, type) => ({ pmid, articleYear: year, publicationTypeCanonical: type, publicationDateStandardized: `${year}-01-01`, authors: [] })
    const arts = [a(1, 2020, 'Letter'), a(2, 2024, 'Academic Article'), a(3, 2024, 'Review'), a(-4, 0, 'Book')]
    const byYear = groupArticles(arts, 'year')
    assert.deepEqual(byYear.map((g) => g.heading), ['2024', '2020', 'Year not available'])
    assert.equal(byYear.reduce((n, g) => n + g.articles.length, 0), 4)
    const byType = groupArticles(arts, 'type')
    assert.deepEqual(byType.map((g) => g.heading), ['Academic Article', 'Review', 'Letter', 'Book'])
    const byPerson = groupArticles(arts, 'person', {
        pairs: [{ personIdentifier: 'zz1', pmid: 1 }, { personIdentifier: 'aa1', pmid: 2 }, { personIdentifier: 'aa1', pmid: 1 }],
        persons: [{ personIdentifier: 'zz1', firstName: 'Zed', lastName: 'Alpha' }, { personIdentifier: 'aa1', firstName: 'Ann', lastName: 'Beta' }],
    })
    assert.deepEqual(byPerson.map((g) => g.heading), ['Alpha, Zed (zz1)', 'Beta, Ann (aa1)'])
    assert.deepEqual(byPerson[1].articles.map((x) => x.pmid), [2, 1])
})

test('yearOf and wordLimit', () => {
    assert.equal(yearOf({ articleYear: 0, publicationDateDisplay: '2019 Mar 3' }), 2019)
    assert.equal(yearOf({ articleYear: null, publicationDateDisplay: '' }), null)
    assert.equal(wordLimit('4000'), 4000)
    assert.equal(wordLimit(false), 1000)
    assert.equal(wordLimit('999999'), WORD_LIMIT_CEILING)
})
