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

// ---- 2b card summary ----
import {
    authorKey, buildCoauthorIndex, knownCoauthorsOf, identityChips, tallyOf, affiliationParts,
} from '../src/utils/identityEvidence.ts'

const au = (firstName, lastName, targetAuthor = false) => ({ firstName, lastName, targetAuthor })
const articles = [
    { pmid: 1, userAssertion: 'ACCEPTED', reCiterArticleAuthorFeatures: [au('Paul', 'Albert', true), au('Michael', 'Bales'), au('Jie', 'Lin')] },
    { pmid: 2, userAssertion: 'ACCEPTED', reCiterArticleAuthorFeatures: [au('Curtis', 'Cole'), au('P', 'Albert', true)] },
    { pmid: 3, userAssertion: 'REJECTED', reCiterArticleAuthorFeatures: [au('Zed', 'Zulu'), au('Philipp', 'Albert', true)] },
]

test('authorKey: last name + first initial, accents and punctuation folded', () => {
    assert.equal(authorKey({ firstName: 'José', lastName: "O'Brién" }), 'obrien|j')
    assert.equal(authorKey({ firstName: 'X' }), '')
})

test('knownCoauthorsOf: other accepted papers only, never the person', () => {
    const idx = buildCoauthorIndex(articles)
    // The person under any name form is never a co-author, even when not flagged as target here
    const art = { pmid: 9, reCiterArticleAuthorFeatures: [au('Paul', 'Albert'), au('Michael', 'Bales'), au('Zed', 'Zulu'), au('Curtis', 'Cole')] }
    assert.deepEqual(knownCoauthorsOf(art, idx), { hits: ['Michael Bales', 'Curtis Cole'], total: 3, indexEmpty: false })
    // An accepted paper's own co-authors don't make themselves "known"
    const own = knownCoauthorsOf(articles[0], idx)
    assert.deepEqual(own.hits, [])
    assert.equal(own.total, 2)
    assert.equal(knownCoauthorsOf(art, null), null)
})

test('identityChips + tallyOf: kinds follow the evidence rows', () => {
    const chips = identityChips(evidence, { hits: ['Ann Lee'], total: 3, indexEmpty: false })
    assert.deepEqual(chips.map(c => [c.label, c.kind]), [
        ['Name', 'match'], ['Career', 'nodata'], ['Affiliation', 'match'], ['Field', 'nodata'], ['Co-authors', 'match'],
    ])
    assert.match(chips[0].tip, /^Name: Strong match \(1\.23 pts\)$/)
    assert.equal(identityChips(evidence, { hits: [], total: 2, indexEmpty: false })[4].kind, 'partial')
    assert.equal(identityChips(evidence, { hits: [], total: 2, indexEmpty: true })[4].kind, 'nodata')
    assert.deepEqual(identityChips(undefined, null), [])
    assert.equal(tallyOf(chips).text, 'Identity 3 match')
    assert.equal(tallyOf([{ kind: 'match' }, { kind: 'partial' }, { kind: 'mismatch' }]).text, 'Identity 1 match · 1 partial · 1 mismatch')
})

test('affiliationParts: highlights the matched institution segment', () => {
    const raw = 'Samuel J. Wood Library, Weill Cornell Medical College, New York, NY, USA.'
    const ev = { affiliationEvidence: {
        pubmedTargetAuthorAffiliation: { targetAuthorInstitutionalAffiliationMatchType: 'POSITIVE_MATCH_INSTITUTION', targetAuthorInstitutionalAffiliationArticlePubmedLabel: raw },
        scopusTargetAuthorAffiliation: [{ targetAuthorInstitutionalAffiliationMatchType: 'POSITIVE_MATCH_INSTITUTION', targetAuthorInstitutionalAffiliationIdentity: 'Weill Cornell Medicine' }],
    } }
    const p = affiliationParts(ev)
    assert.equal(p.hit, 'Weill Cornell Medical College')
    assert.equal(p.pre + p.hit + p.post, raw)
    // Unscored PubMed label (the common case in prod) still highlights
    delete ev.affiliationEvidence.pubmedTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationMatchType
    assert.equal(affiliationParts(ev).hit, 'Weill Cornell Medical College')
    ev.affiliationEvidence.pubmedTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationMatchType = 'NO_MATCH'
    assert.deepEqual(affiliationParts(ev), { pre: raw, hit: '', post: '' })
    assert.equal(affiliationParts({}), null)
})
