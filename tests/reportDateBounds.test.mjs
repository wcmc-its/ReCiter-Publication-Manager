// Unit tests for the /report CSV export date range (publication.report.controller.ts). The
// end-date-only branch used Op.gt, so an export with only an end date returned rows after it.
import test from 'node:test'
import assert from 'node:assert/strict'
import { Op } from 'sequelize'
import { entrezDateBoundClauses } from '../controllers/db/reports/reportDateBounds.ts'

const COL = '$AnalysisSummaryArticle.datePublicationAddedToEntrez$'

test('end date only: rows before the end date', () => {
    const c = entrezDateBoundClauses(undefined, '2024-06-30')
    assert.equal(c.length, 1)
    assert.deepEqual(c[0][COL], { [Op.lt]: '2024-06-30' })
    assert.equal(c[0][COL][Op.gt], undefined)
})

test('start date only: rows after the start date', () => {
    const c = entrezDateBoundClauses('2024-01-01', '')
    assert.equal(c.length, 1)
    assert.deepEqual(c[0][COL], { [Op.gt]: '2024-01-01' })
})

test('both dates: after start and before end', () => {
    const c = entrezDateBoundClauses('2024-01-01', '2024-06-30')
    assert.deepEqual(c.map((x) => x[COL]), [{ [Op.gt]: '2024-01-01' }, { [Op.lt]: '2024-06-30' }])
})

test('no dates: no clauses', () => {
    assert.deepEqual(entrezDateBoundClauses(undefined, undefined), [])
    assert.deepEqual(entrezDateBoundClauses('', null), [])
})
