// Unit tests for src/utils/identityEvidence.ts (the Curate card's identity-evidence rows).
// Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
    buildEvidenceRows, determineMatchType, displayRow, fullName, MATCH_COLORS,
} from '../src/utils/identityEvidence.ts'

const evidence = {
    authorNameEvidence: {
        nameScoreTotal: 1.234,
        institutionalAuthorName: { firstName: 'Paul', lastName: 'Albert' },
        articleAuthorName: { firstName: 'Paul', middleInitial: 'J', middleName: 'J', lastName: 'Albert' },
    },
    emailEvidence: { emailMatchScore: 4, emailMatch: 'paa2013@med.cornell.edu' },
    relationshipEvidence: {
        relationshipPositiveMatchScore: 2.5, relationshipNegativeMatchScore: -0.5, relationshipIdentityCount: 3,
        relationshipPositiveMatch: [{ relationshipNameIdentity: { firstName: 'Ann', lastName: 'Lee' }, relationshipType: ['Co-investigator'] }],
    },
    affiliationEvidence: {
        scopusTargetAuthorAffiliation: [{
            targetAuthorInstitutionalAffiliationMatchType: 'POSITIVE_MATCH_INSTITUTION',
            targetAuthorInstitutionalAffiliationMatchTypeScore: 1.5,
            targetAuthorInstitutionalAffiliationIdentity: 'Weill Cornell Medicine',
            targetAuthorInstitutionalAffiliationArticleScopusLabel: 'Weill Cornell Medical College',
            targetAuthorInstitutionalAffiliationArticleScopusAffiliationId: 60007997,
        }],
        pubmedTargetAuthorAffiliation: {
            targetAuthorInstitutionalAffiliationMatchType: 'POSITIVE_MATCH_INSTITUTION',
            targetAuthorInstitutionalAffiliationMatchTypeScore: 0.5,
            targetAuthorInstitutionalAffiliationArticlePubmedLabel: 'Weill Cornell Medicine, New York, NY',
        },
        scopusNonTargetAuthorAffiliation: {
            nonTargetAuthorInstitutionalAffiliationScore: 0.75,
            nonTargetAuthorInstitutionalAffiliationMatchKnownInstitution: ['Weill Cornell Medicine, 60007997, 4'],
        },
    },
    genderEvidence: { genderScoreIdentity: 0.9, genderScoreArticle: 0.2, genderScoreIdentityArticleDiscrepancy: -3 },
    grantEvidence: { grants: [{ grantMatchScore: 0.25, institutionGrant: 'R01 CA1', articleGrant: 'CA1' }] },
}

test('determineMatchType: thresholds', () => {
    assert.equal(determineMatchType('x', 0), 'nodata')
    assert.equal(determineMatchType('x', ''), 'nodata')
    assert.equal(determineMatchType('x', 'abc'), 'nodata')
    assert.equal(determineMatchType('x', 1.01), 'match')
    assert.equal(determineMatchType('x', '1'), 'partial')
    assert.equal(determineMatchType('x', 0.1), 'partial')
    assert.equal(determineMatchType('x', -0.1), 'mismatch')
    assert.deepEqual(Object.keys(MATCH_COLORS), ['match', 'partial', 'mismatch', 'nodata'])
})

test('fullName: joins parts with trailing space', () => {
    assert.equal(fullName({ firstName: 'Paul', lastName: 'Albert' }), 'Paul Albert ')
    assert.equal(fullName(undefined), '')
})

test('displayRow: absent evidence hidden; co-author row needs scopusNonTargetAuthorAffiliation', () => {
    assert.ok(displayRow({ emailEvidence: 'Email' }, evidence))
    assert.ok(!displayRow({ journalCategoryEvidence: 'Journal category' }, evidence))
    assert.ok(displayRow({ coAuthorAffiliationEvidence: 'x' }, evidence))
    assert.ok(!displayRow({ coAuthorAffiliationEvidence: 'x' }, { affiliationEvidence: {} }))
})

test('buildEvidenceRows: name first, rest sorted by |points|', () => {
    const rows = buildEvidenceRows(evidence)
    assert.deepEqual(rows.map(r => r.name), [
        'authorNameEvidence', 'emailEvidence', 'genderEvidence', 'relationshipEvidence',
        'affiliationEvidence', 'coAuthorAffiliationEvidence', 'grantEvidence',
    ])
    assert.equal(rows[0].points, '1.23')
    assert.equal(rows[0].institutionalData, 'Paul Albert ')
})

test('buildEvidenceRows: per-row values', () => {
    const by = Object.fromEntries(buildEvidenceRows(evidence).map(r => [r.name, r]))
    assert.equal(by.relationshipEvidence.points, '2.00')
    assert.equal(by.relationshipEvidence.pointsText, '+2.50 / −0.50 · 3 identities')
    assert.ok(by.relationshipEvidence.spanData)
    assert.deepEqual(by.relationshipEvidence.institutionalDataList, [{ name: 'Ann Lee ', tags: ['Co-investigator'] }])

    assert.equal(by.affiliationEvidence.points, '2')
    assert.equal(by.affiliationEvidence.displayInstDataList, false)
    assert.deepEqual(by.affiliationEvidence.articleDataList.map(i => i.tags[0]), ['Scopus', 'PubMed'])
    assert.equal(by.affiliationEvidence.articleDataList[0].source, 'https://www.scopus.com/affil/profile.uri?afid=60007997')

    assert.equal(by.coAuthorAffiliationEvidence.points, '0.75')
    assert.equal(by.coAuthorAffiliationEvidence.articleDataList[0].name, '4 author(s) from ')

    assert.equal(by.emailEvidence.points, '4')
    assert.equal(by.emailEvidence.articleData, 'paa2013@med.cornell.edu')
    assert.equal(by.genderEvidence.points, '-3')
    assert.equal(by.genderEvidence.institutionalData, 'Male - 90% probability')
    assert.equal(by.genderEvidence.articleData, 'Female - 80% probability')
    assert.equal(by.genderEvidence.source, 'https://data.world/howarder/gender-by-name')
    assert.equal(by.grantEvidence.points, '0.25')
})
