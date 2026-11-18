// Unit tests for the PR 6 helpers in src/utils/authorshipRow.ts: identity-conflict rows and the
// in-card empty state. Also the queue's sort table and precision-lane predicate
// (controllers/db/authorshipQueueSql.ts). Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { Sequelize, Op } from 'sequelize'
import { conflictIdentities, conflictKeep, emptyState } from '../src/utils/authorshipRow.ts'
import { SORTS, precisionWhere, orcidLaneBulkWhere } from '../controllers/db/authorshipQueueSql.ts'

test('conflictIdentities lists the proposed identity, then each person who accepted it', () => {
    const ids = conflictIdentities({
        top_cwid: 'paa2013', top_name: 'Paul J. Albert', top_io_score: 92.4,
        accepted_by: [{ cwid: 'jma2016', name: 'Jonathan M. Albert' }],
    }, [{ cwid: 'JMA2016', io_score: 40 }])
    assert.deepEqual(ids, [
        { cwid: 'paa2013', name: 'Paul J. Albert', io: 92.4, accepted: false },
        { cwid: 'jma2016', name: 'Jonathan M. Albert', io: 40, accepted: true },
    ])
})

test('conflictIdentities never lists a person twice and tolerates no IO', () => {
    const ids = conflictIdentities({
        top_cwid: 'abc1', top_name: '', top_io_score: null,
        accepted_by: [{ cwid: 'ABC1', name: 'X' }, { cwid: 'def2', name: '' }, { cwid: 'def2', name: 'Dup' }],
    })
    assert.deepEqual(ids.map((i) => [i.cwid, i.name, i.io, i.accepted]), [['abc1', 'abc1', null, false], ['def2', 'def2', null, true]])
    assert.deepEqual(conflictIdentities({ top_cwid: null, accepted_by: [] }), [])
})

test('conflictKeep: keeping the proposed identity accepts or assigns to it', () => {
    assert.deepEqual(conflictKeep({ top_cwid: 'paa2013', single_candidate: true }, 'PAA2013'), { action: 'accept' })
    assert.deepEqual(conflictKeep({ top_cwid: 'paa2013', single_candidate: false }, 'paa2013', ['paa2013', 'jma2016']),
        { action: 'assign', extra: { cwid: 'paa2013' } })
})

test('conflictKeep: keeping the person who accepted it rejects, unless reject would hit them', () => {
    assert.deepEqual(conflictKeep({ top_cwid: 'paa2013', single_candidate: true }, 'jma2016', ['paa2013']), { action: 'reject' })
    // multi row whose candidates do not include them: reject-all is safe
    assert.deepEqual(conflictKeep({ top_cwid: 'paa2013', single_candidate: false }, 'jma2016', ['paa2013', 'xyz9']), { action: 'reject' })
    // multi row that lists them: reject-all would write "not mine" over their acceptance
    assert.deepEqual(conflictKeep({ top_cwid: 'paa2013', single_candidate: false }, 'jma2016', ['paa2013', 'JMA2016']), { action: 'dismiss' })
})

test('emptyState: filtered queue names how many fall outside and offers Reset', () => {
    assert.deepEqual(emptyState({ statusView: 'open', queueTotal: 23, filtersOn: true }), {
        title: 'No rows match these filters',
        body: '23 unassigned authorships fall outside the current source, filters, or search.',
        canReset: true,
    })
    assert.equal(emptyState({ statusView: 'conflicts', queueTotal: 1, filtersOn: false }).body,
        '1 authorship with an identity conflict falls outside the current source, filters, or search.')
    assert.equal(emptyState({ statusView: 'open', queueTotal: 1200, filtersOn: true }).body.startsWith('1,200 '), true)
    assert.equal(emptyState({ statusView: 'open', queueTotal: null, filtersOn: true }).body,
        'Nothing in this queue matches the current source, filters, or search.')
})

test('emptyState: an empty queue says so, per queue, with no Reset', () => {
    assert.deepEqual(emptyState({ statusView: 'open', queueTotal: 0, filtersOn: true }),
        { title: 'Queue is clear', body: 'Every open authorship has been assigned, rejected, snoozed, or dismissed.', canReset: false })
    assert.equal(emptyState({ statusView: 'snoozed', queueTotal: 0, filtersOn: false }).title, 'No snoozed authorships')
    assert.equal(emptyState({ statusView: 'duplicates', queueTotal: 0, filtersOn: false }).title, 'No duplicates left')
})

// The predicates as MySQL text. The query generator needs no connection, and none is opened.
const whereSql = (w) => new Sequelize({ dialect: 'mysql' }).getQueryInterface().queryGenerator.getWhereConditions(w)

test('precisionWhere: single and fullname lanes are unchanged, anything else adds nothing', () => {
    assert.deepEqual(precisionWhere('single'), { single_candidate: true })
    assert.deepEqual(precisionWhere('fullname'), { single_candidate: true, top_given_match: 'full' })
    for (const p of ['all', '', undefined, null, 'VENUEFIT', "venuefit' OR 1=1", ['venuefit'], { venuefit: true }]) {
        assert.equal(precisionWhere(p), null)
    }
})

test('precisionWhere: venuefit is one candidate, an initial-only match and byline, and a good venue fit', () => {
    assert.equal(whereSql(precisionWhere('venuefit')),
        "((`single_candidate` = true AND `top_given_match` = 'initial' AND `top_venue_fit` >= 1) AND "
        + "CHAR_LENGTH(REPLACE(SUBSTRING_INDEX(`wcm_author`, ' ', 1), '.', '')) = 1)")
})

// `= true` is 1 only: a person only the ORCID put on the list carries 2 and stays out.
test('precisionWhere: orcid is every row whose name-matched top pick the byline ORCID confirms', () => {
    assert.deepEqual(precisionWhere('orcid'), { top_orcid_match: true })
    assert.equal(whereSql(precisionWhere('orcid')), "`top_orcid_match` = true")
    for (const p of ['ORCID', 'orcid_match', "orcid' OR 1=1", ['orcid'], { orcid: true }]) {
        assert.equal(precisionWhere(p), null)
    }
})

// The server's copy of orcidLaneBulkOk (tests/authorshipRow.test.mjs has the cases).
test('orcidLaneBulkWhere: Ithaca by campus or, without one, by person type; otherwise a Scholars iD', () => {
    const j = '`AuthorshipReview`.`candidate_cwids_json`'
    const top = (k) => `JSON_UNQUOTE(JSON_EXTRACT(IF(CASE WHEN JSON_VALID(${j}) THEN JSON_TYPE(${j}) = 'ARRAY' END, ${j}, NULL), '$[0].${k}'))`
    assert.equal(whereSql(orcidLaneBulkWhere()),
        "(COALESCE(NULLIF(" + top('campus') + ", 'null') = 'cornell-ithaca', `AuthorshipReview`.`top_person_type` LIKE 'Cornell%', 0)"
        + " OR COALESCE(" + top('orcid_source') + " = 'scholars', 0))")
    // ANDs onto the lane's own predicate as one parenthesised term
    assert.match(whereSql({ [Op.and]: [precisionWhere('orcid'), { single_candidate: true }, orcidLaneBulkWhere()] }),
        /^\(`top_orcid_match` = true AND `single_candidate` = true AND \(COALESCE\(.+\)\)$/)
})

const sortKeys = (sort) => SORTS[sort].map(([k, dir]) => (typeof k === 'string' ? `${k} ${dir}` : `<expr> ${dir}`))

test('SORTS: top_confidence breaks top_io_score ties behind pmid, so PubMed order is as it was', () => {
    assert.deepEqual(sortKeys('precision'), ['single_candidate DESC', 'top_io_score DESC', 'pmid DESC', 'top_confidence DESC', 'id DESC'])
    assert.deepEqual(sortKeys('io'), ['top_io_score DESC', 'pmid DESC', 'top_confidence DESC', 'id DESC'])
    assert.deepEqual(sortKeys('candidates'), ['<expr> DESC', 'top_io_score DESC', 'pmid DESC', 'top_confidence DESC', 'id DESC'])
    // every sort that orders by top_io_score keeps pmid right behind it, then the tiebreaker
    for (const sort of Object.keys(SORTS)) {
        const k = sortKeys(sort)
        const i = k.indexOf('top_io_score DESC')
        if (i > -1) assert.deepEqual(k.slice(i + 1, i + 3), ['pmid DESC', 'top_confidence DESC'], sort)
    }
})

test('SORTS: the sorts that never used top_io_score are as they were, apart from the closing id', () => {
    assert.deepEqual(SORTS.confidence, [['top_confidence', 'DESC'], ['pmid', 'DESC'], ['id', 'DESC']])
    assert.deepEqual(SORTS.fg, [['top_fg_score', 'DESC'], ['pmid', 'DESC'], ['id', 'DESC']])
    assert.deepEqual(SORTS.date, [['entrez_date', 'DESC'], ['pmid', 'DESC'], ['id', 'DESC']])
    assert.deepEqual(SORTS.date_asc, [['entrez_date', 'ASC'], ['pmid', 'ASC'], ['id', 'ASC']])
    assert.deepEqual(Object.keys(SORTS), ['precision', 'confidence', 'io', 'fg', 'date', 'date_asc', 'candidates'])
})

test('SORTS: every sort ends on the unique id, in the direction of the key before it', () => {
    for (const sort of Object.keys(SORTS)) {
        const k = sortKeys(sort)
        assert.equal(k[k.length - 1], `id ${k[k.length - 2].split(' ')[1]}`, sort)
    }
})
