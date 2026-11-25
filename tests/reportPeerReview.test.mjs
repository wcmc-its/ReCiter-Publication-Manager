// Unit tests for the /report 5d-1 helpers: the Peer review filter fragment, its options, the
// "Not peer-reviewed" chip and roles after names. Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { peerReviewSql, dateTypeSql } from '../controllers/db/reports/reportFilterSql.ts'
import { describeFilters, hasAnyFilter, buildReportExportWhere } from '../controllers/db/reports/reportExportSql.ts'
import { peerReviewOptions, notPeerReviewedChip, bylineRoleSuffix, authorRoleNote } from '../src/utils/reportRow.ts'
import { PUB_TYPES, PUB_TYPE_GROUPS, defaultPeerReviewed, defaultRole } from '../src/lib/pubTypes.ts'

test('peerReviewSql: yes / no, Any when neither or both, nothing without the column', () => {
    assert.equal(peerReviewSql('asa', ['yes'], true), '(asa.peerReviewed = 1)')
    assert.equal(peerReviewSql('AnalysisSummaryArticle', ['no'], true), '(AnalysisSummaryArticle.peerReviewed = 0)')
    assert.equal(peerReviewSql('asa', 'NO', true), '(asa.peerReviewed = 0)')
    assert.equal(peerReviewSql('asa', ['yes', 'no'], true), null)
    assert.equal(peerReviewSql('asa', ['yes', 'yes'], true), '(asa.peerReviewed = 1)')
    assert.equal(peerReviewSql('asa', [], true), null)
    assert.equal(peerReviewSql('asa', undefined, true), null)
    assert.equal(peerReviewSql('asa', ["1) OR (1=1"], true), null)
    // prod before v3.10: the filter is ignored rather than erroring on a missing column
    assert.equal(peerReviewSql('asa', ['yes'], false), null)
})

test('dateTypeSql carries the Peer review fragment, so every search and export path applies it', () => {
    const ALL = { pubType: true, pubDate: true, dateAdded: true, peerReviewed: true }
    assert.deepEqual(dateTypeSql('asa', { peerReview: ['no'] }, ALL, PUB_TYPES), ['(asa.peerReviewed = 0)'])
    assert.deepEqual(dateTypeSql('asa', { peerReview: ['no'] }, { pubType: true }, PUB_TYPES), [])
    const both = dateTypeSql('asa', { pubTypes: ['Review'], peerReview: ['yes'] }, ALL, PUB_TYPES)
    assert.deepEqual(both, ["(asa.pubType IN ('Review'))", '(asa.peerReviewed = 1)'])
})

test('exports: Peer review alone unlocks only when it built a clause; About sheet names it', () => {
    const f = { peerReview: ['yes'] }
    assert.equal(hasAnyFilter(f, { authorPosition: null, source: null, dateType: ['(asa.peerReviewed = 1)'] }), true)
    assert.equal(hasAnyFilter(f, { authorPosition: null, source: null, dateType: [] }), false)
    const w = buildReportExportWhere(f, { authorPosition: null, source: null, dateType: ['(asa.peerReviewed = 1)'] })
    assert.equal(w.articleSql, '(asa.peerReviewed = 1)')
    assert.deepEqual(describeFilters({ peerReview: ['no'] }), [['Peer review', 'Not peer-reviewed']])
    assert.deepEqual(describeFilters({ peerReview: ['yes', 'no'] }), [])
})

test('peerReviewOptions: counts per value; empty hides the filter', () => {
    assert.deepEqual(peerReviewOptions([{ peerReviewed: 1, count: 264971 }, { peerReviewed: 0, count: '30938' }]).map((o) => [o.key, o.label, o.count]), [
        ['yes', 'Peer-reviewed', 264971], ['no', 'Not peer-reviewed', 30938],
    ])
    assert.deepEqual(peerReviewOptions([]), [])
    assert.deepEqual(peerReviewOptions([{ peerReviewed: null, count: 5 }]), [])
})

test('notPeerReviewedChip: only for 0, tooltip names the source', () => {
    assert.equal(notPeerReviewedChip({ peerReviewed: 1, pubType: 'Review' }), null)
    assert.equal(notPeerReviewedChip({ peerReviewed: null, pubType: 'Letter' }), null)
    assert.equal(notPeerReviewedChip({ pubType: 'Letter' }), null) // no column
    assert.deepEqual(notPeerReviewedChip({ peerReviewed: 0, peerReviewedSource: 'type-default', pubType: 'Letter' }), { tip: 'Default for Letter' })
    assert.deepEqual(notPeerReviewedChip({ peerReviewed: '0', pubType: 'Preprint' }), { tip: 'Default for Preprint' })
    assert.deepEqual(notPeerReviewedChip({ peerReviewed: 0, peerReviewedSource: 'curator', pubType: 'Book Chapter' }), { tip: 'Set by hand on this record' })
    assert.match(notPeerReviewedChip({ peerReviewed: 0, pubType: null }).tip, /isn't known/)
})

test('roles after names: edited types get a byline suffix, other non-Author roles a note', () => {
    assert.equal(bylineRoleSuffix('Edited Book', 3), ', editors')
    assert.equal(bylineRoleSuffix('Conference Proceedings', 1), ', editor')
    assert.equal(bylineRoleSuffix('Academic Article', 3), '')
    assert.equal(bylineRoleSuffix('Edited Book', 0), '')
    assert.equal(authorRoleNote('Book Chapter', 'Section editor'), 'section editor')
    assert.equal(authorRoleNote('Book', 'Translator'), 'translator')
    assert.equal(authorRoleNote('Academic Article', 'Author'), '')
    assert.equal(authorRoleNote('Academic Article', null), '')
    assert.equal(authorRoleNote('Edited Book', 'Editor'), '') // the suffix says it
    assert.equal(authorRoleNote('Reference Entry', 'Editor'), '') // venueOf says it
})

test('the suffix agrees with pubTypes.ts defaultRole, and the chip with defaultPeerReviewed', () => {
    for (const g of PUB_TYPE_GROUPS) {
        for (const t of g.types) {
            assert.equal(bylineRoleSuffix(t, 2) !== '', defaultRole(t) === 'Editor', t)
            const pr = defaultPeerReviewed(t) ? 1 : 0
            assert.equal(notPeerReviewedChip({ peerReviewed: pr, pubType: t }) !== null, !defaultPeerReviewed(t), t)
        }
    }
})
