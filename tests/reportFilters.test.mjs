// Unit tests for the /report 5a/5b helpers: Middle author / Source SQL fragments and the result-row
// helpers (source badge, ids, WCM first/last author, citation block). Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { authorPositionSql, sourceSql } from '../controllers/db/reports/reportFilterSql.ts'
import { sourceOf, externalIdOf, pmcidHref, wcmPositionText, citationBlock } from '../src/utils/reportRow.ts'

test('authorPositionSql: middle is NULL, values are allowlisted', () => {
    assert.equal(authorPositionSql('asu', ['first', 'last']), "(asu.authorPosition IN ('first', 'last'))")
    assert.equal(authorPositionSql('asu', ['middle']), '(asu.authorPosition IS NULL)')
    assert.equal(authorPositionSql('AnalysisSummaryAuthor', ['first', 'middle']),
        "(AnalysisSummaryAuthor.authorPosition IN ('first') OR AnalysisSummaryAuthor.authorPosition IS NULL)")
    assert.equal(authorPositionSql('asu', ["first'; drop table x; --"]), null)
    assert.equal(authorPositionSql('asu', []), null)
    assert.equal(authorPositionSql('asu', undefined), null)
})

test('sourceSql: source_type column, with PUBMED as the NULL default', () => {
    assert.equal(sourceSql('asa', ['SCOPUS', 'OPENALEX'], true), "(COALESCE(asa.source_type, 'PUBMED') IN ('SCOPUS', 'OPENALEX'))")
    assert.equal(sourceSql('asa', ['PUBMED'], true), "(COALESCE(asa.source_type, 'PUBMED') IN ('PUBMED'))")
    assert.equal(sourceSql('asa', ['bogus'], true), null)
    assert.equal(sourceSql('asa', [], true), null)
})

test('sourceSql: without the column, falls back on the pmid sign', () => {
    assert.equal(sourceSql('asa', ['PUBMED'], false), '(asa.pmid > 0)')
    assert.equal(sourceSql('asa', ['SCOPUS'], false), '(asa.pmid < 0)')
    assert.equal(sourceSql('asa', ['PUBMED', 'CROSSREF'], false), '(1 = 1)')
})

test('sourceOf', () => {
    assert.equal(sourceOf({ sourceType: 'SCOPUS', pmid: -3 }).label, 'Scopus')
    assert.equal(sourceOf({ sourceType: null, pmid: 33534808 }).label, 'PubMed')
    assert.equal(sourceOf({ pmid: -4, articleId: 'OPENALEX:W2741809807' }).label, 'OpenAlex')
    assert.equal(sourceOf({ pmid: -5 }).label, 'External')
    assert.equal(sourceOf({ sourceType: 'PUBMED', pmid: 1 }).tone, 'slate')
})

test('externalIdOf / pmcidHref', () => {
    assert.deepEqual(externalIdOf({ pmid: -1, articleId: 'SCOPUS:105037533819' }), {
        label: 'EID', value: '2-s2.0-105037533819',
        href: 'https://www.scopus.com/record/display.uri?eid=2-s2.0-105037533819&origin=resultslist',
    })
    assert.equal(externalIdOf({ pmid: -1, articleId: 'OPENALEX:W4404410236' }).href, 'https://openalex.org/W4404410236')
    assert.equal(externalIdOf({ pmid: 123, articleId: 'SCOPUS:1' }), null)
    assert.equal(externalIdOf({ pmid: -1, articleId: 'CROSSREF:10.1/x' }), null)
    assert.equal(pmcidHref('PMC11608113'), 'https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11608113/')
    assert.equal(pmcidHref(''), null)
    assert.equal(pmcidHref('NULL'), null)
})

test('wcmPositionText', () => {
    const a = (cwid, rank) => ({ personIdentifier: cwid, rank })
    assert.equal(wcmPositionText([a('x', 1), a(null, 2), a(null, 3)]), 'WCM first author')
    assert.equal(wcmPositionText([a(null, 1), a(null, 2), a('y', 3)]), 'WCM last author')
    assert.equal(wcmPositionText([a('y', 3), a('x', 1), a(null, 2)]), 'WCM first & last author') // sorted by rank
    assert.equal(wcmPositionText([a(null, 1), a('m', 2), a(null, 3)]), '')
    assert.equal(wcmPositionText([a('solo', 1)]), 'WCM first author')
    assert.equal(wcmPositionText([]), '')
    assert.equal(wcmPositionText(undefined), '')
})

test('citationBlock: NIH, else Scopus; RCR / percentile pill', () => {
    const nih = citationBlock({ citationCountNIH: 31, citationCountScopus: 40, relativeCitationRatioNIH: 2.21, percentileNIH: 88.4, pmid: 1 })
    assert.equal(nih.count, 31)
    assert.equal(nih.label, 'citations (NIH)')
    assert.equal(nih.pill, 'RCR 2.21 · NIH 88th pct')
    assert.equal(nih.pillStrong, true)
    const scopus = citationBlock({ citationCountNIH: null, citationCountScopus: 24, pmid: -2 })
    assert.equal(scopus.count, 24)
    assert.equal(scopus.label, 'citations (Scopus)')
    assert.equal(scopus.pill, '')
    assert.match(scopus.tip, /no NIH metrics outside PubMed/)
    const hidden = citationBlock({ citationCountNIH: 3, relativeCitationRatioNIH: 1.1, percentileNIH: 12, pmid: 1 }, { showRcr: false, showPct: false })
    assert.equal(hidden.pill, '')
    assert.equal(citationBlock({ citationCountNIH: 0, pmid: 1 }).count, 0)
    assert.equal(citationBlock({ percentileNIH: 1, pmid: 1, relativeCitationRatioNIH: null }).pill, 'NIH 1st pct')
})

test('citationBlock: iCite 0 / 0 (too new to benchmark) shows no pill', () => {
    const b = citationBlock({ citationCountNIH: 0, relativeCitationRatioNIH: 0, percentileNIH: 0, pmid: 41578435 })
    assert.equal(b.pill, '')
    assert.match(b.tip, /not computed/)
    assert.equal(citationBlock({ citationCountNIH: 2, relativeCitationRatioNIH: 0.4, percentileNIH: 0, pmid: 1 }).pill, 'RCR 0.40 · NIH 0th pct')
})
