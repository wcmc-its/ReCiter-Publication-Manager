// Unit tests for the 5f Excel export SQL builder. Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { authorPositionSql, sourceSql } from '../controllers/db/reports/reportFilterSql.ts'
import {
    hasAnyFilter, buildReportExportWhere, articleCountSql, articlePmidsSql, authorshipCountSql,
    describeFilters, XLSX_MAX_ARTICLES,
} from '../controllers/db/reports/reportExportSql.ts'

const frag = (f, hasSource = true) => ({
    authorPosition: authorPositionSql('asu', f.authorPosition),
    source: sourceSql('asa', f.sourceTypes, hasSource),
})

test('hasAnyFilter: empty or blank filters are refused', () => {
    assert.equal(hasAnyFilter(undefined), false)
    const blank = { personIdentifers: [], orgUnits: [], institutions: [], personTypes: [], authorPosition: [],
        sourceTypes: [], datePublicationAddedToEntrezLowerBound: '', datePublicationAddedToEntrezUpperBound: '',
        publicationTypeCanonical: [], journalTitleVerbose: [] }
    assert.equal(hasAnyFilter(blank, frag(blank)), false)
    // a bogus author position or source is no filter at all
    const bogus = { ...blank, authorPosition: ['nope'], sourceTypes: ['NOPE'] }
    assert.equal(hasAnyFilter(bogus, frag(bogus)), false)
    // one SJR bound alone is ignored by the page, so it is no filter here either
    assert.equal(hasAnyFilter({ journalImpactScoreLowerBound: 1 }, frag({})), false)
})

test('hasAnyFilter: any real filter counts', () => {
    assert.equal(hasAnyFilter({ personIdentifers: ['abc1234'] }, frag({})), true)
    assert.equal(hasAnyFilter({ datePublicationAddedToEntrezLowerBound: '2025-01-01' }, frag({})), true)
    const pos = { authorPosition: ['middle'] }
    assert.equal(hasAnyFilter(pos, frag(pos)), true)
    const src = { sourceTypes: ['SCOPUS'] }
    assert.equal(hasAnyFilter(src, frag(src)), true)
    assert.equal(hasAnyFilter({ journalImpactScoreLowerBound: 3, journalImpactScoreUpperBound: 1000 }, frag({})), true)
})

test('article-only filters: no author conditions, no person join, values bound', () => {
    const f = { journalTitleVerbose: ['Cell'], datePublicationAddedToEntrezLowerBound: '2025-01-01', sourceTypes: ['PUBMED'] }
    const w = buildReportExportWhere(f, frag(f))
    assert.equal(w.hasAuthorFilter, false)
    assert.equal(w.joinPerson, false)
    assert.equal(w.authorSql, '1 = 1')
    assert.match(w.articleSql, /asa\.journalTitleVerbose IN \(:journals\)/)
    assert.match(w.articleSql, /asa\.datePublicationAddedToEntrez > :dateLower/)
    assert.match(w.articleSql, /COALESCE\(asa\.source_type, 'PUBMED'\) IN \('PUBMED'\)/)
    assert.deepEqual(w.replacements.journals, ['Cell'])
    const sql = articleCountSql(w)
    assert.match(sql, /^SELECT COUNT\(DISTINCT asa\.pmid\) AS n FROM analysis_summary_article asa WHERE /)
    assert.match(sql, /EXISTS \(SELECT 1 FROM analysis_summary_author asu WHERE asu\.pmid = asa\.pmid AND 1 = 1\)/)
})

test('person joins mirror the page: person type alone skips person, org adds it', () => {
    const typeOnly = { personTypes: ['academic-faculty'] }
    const w1 = buildReportExportWhere(typeOnly, frag(typeOnly))
    assert.equal(w1.joinPerson, false)
    assert.match(w1.authorSql, /ppt\.personType IN \(:personTypes\)/)

    const typeAndOrg = { personTypes: ['academic-faculty'], orgUnits: ["Medicine"] }
    const w2 = buildReportExportWhere(typeAndOrg, frag(typeAndOrg))
    assert.equal(w2.joinPerson, true)
    assert.match(articleCountSql(w2), /INNER JOIN person p ON p\.personIdentifier = asu\.personIdentifier/)

    const posOnly = { authorPosition: ['first', 'last'] }
    const w3 = buildReportExportWhere(posOnly, frag(posOnly))
    assert.equal(w3.joinPerson, true)
    assert.match(w3.authorSql, /asu\.authorPosition IN \('first', 'last'\)/)
})

test('org units are bound, not inlined', () => {
    const f = { orgUnits: ["O'Brien Lab"] }
    const w = buildReportExportWhere(f, frag(f))
    assert.ok(!w.authorSql.includes("O'Brien"))
    assert.equal(w.replacements.orgLike0, "%O'Brien Lab%")
    assert.equal(w.replacements.orgParen0, "%(O'Brien Lab)%")
})

test('SJR needs both bounds, like the page', () => {
    const w = buildReportExportWhere({ journalImpactScoreLowerBound: 3, journalImpactScoreUpperBound: 1000 }, frag({}))
    assert.match(w.articleSql, /asa\.journalImpactScore1 >= :sjrLower AND asa\.journalImpactScore1 < :sjrUpper/)
    const w2 = buildReportExportWhere({ journalImpactScoreLowerBound: 3 }, frag({}))
    assert.equal(w2.articleSql, '1 = 1')
})

test('pmid list: allowlisted sort column, nulls last, capped', () => {
    const w = buildReportExportWhere({ personIdentifers: ['abc1234'] }, frag({}))
    assert.match(articlePmidsSql(w, null, undefined, XLSX_MAX_ARTICLES),
        /ORDER BY isnull\(asa\.datePublicationAddedToEntrez\), asa\.datePublicationAddedToEntrez DESC, asa\.pmid DESC LIMIT 25000$/)
    assert.match(articlePmidsSql(w, 'citationCountNIH', 'asc', 10), /asa\.citationCountNIH ASC, asa\.pmid DESC LIMIT 10$/)
    // anything that isn't a bare column name falls back to the default
    assert.match(articlePmidsSql(w, 'x; drop table y', 'asc', 10), /isnull\(asa\.datePublicationAddedToEntrez\)/)
    assert.match(authorshipCountSql(w), /asu\.personIdentifier <> '' AND asu\.personIdentifier IN \(:people\)/)
})

test('describeFilters lists what was applied', () => {
    assert.deepEqual(describeFilters({ personTypes: ['a', 'b'], datePublicationAddedToEntrezLowerBound: '2025-01-01' }), [
        ['Person type', 'a; b'], ['Added on or after', '2025-01-01'],
    ])
    assert.deepEqual(describeFilters({ pubDateUpperBound: '2020-12-31', pubTypes: ['Review'], publicationTypeCanonical: ['Letter'] }), [
        ['Published on or before', '2020-12-31'], ['Publication type', 'Review; Letter'],
    ])
})

test('5c: date / type fragments replace the legacy date comparison', () => {
    const f = { datePublicationAddedToEntrezLowerBound: '2025-01-01', pubTypes: ['Review'] }
    const dateType = ["(COALESCE(asa.dateAdded, asa.pubDate, NULLIF(asa.datePublicationAddedToEntrez, '')) >= '2025-01-01')", "(asa.pubType IN ('Review'))"]
    const w = buildReportExportWhere(f, { ...frag(f), dateType })
    assert.equal(w.articleSql, dateType.join(' AND '))
    assert.equal(w.replacements.dateLower, undefined)
    // a Publication date or grouped Type filter alone is a filter
    assert.equal(hasAnyFilter({ pubTypes: ['Review'] }, frag({})), true)
    assert.equal(hasAnyFilter({ pubDateLowerBound: '2020-01-01' }, frag({})), true)
    assert.equal(hasAnyFilter({}, { ...frag({}), dateType: ["(asa.pubType IN ('Review'))"] }), true)
    assert.equal(hasAnyFilter({}, { ...frag({}), dateType: [] }), false)
})

test('5c: pmid list sorts on a reportSortExpr expression', () => {
    const w = buildReportExportWhere({ personIdentifers: ['abc1234'] }, frag({}))
    const expr = "COALESCE(asa.dateAdded, asa.pubDate, NULLIF(asa.datePublicationAddedToEntrez, ''))"
    assert.match(articlePmidsSql(w, expr, 'desc', 10), /ORDER BY isnull\(COALESCE\(asa\.dateAdded, asa\.pubDate, NULLIF\(asa\.datePublicationAddedToEntrez, ''\)\)\), COALESCE\(.*\) DESC, asa\.pmid DESC LIMIT 10$/)
    assert.match(articlePmidsSql(w, "asa.x) -- ", 'asc', 10), /isnull\(asa\.datePublicationAddedToEntrez\)/)
})
