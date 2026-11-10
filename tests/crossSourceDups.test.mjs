// Unit tests for crossSourceDuplicates in src/lib/pubTypes.ts. Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { crossSourceDuplicates, extSourceLabel, isMarkedDifferent, notDupNote, reopenDupNote } from '../src/lib/pubTypes.ts'

const pub = (pmid, title, date, doi) => ({ pmid, articleTitle: title, publicationDateStandardized: date, doi })
const ext = (articleId, title, pubDate, doi, extra = {}) => ({ articleId, sourceType: articleId.split(':')[0], title, pubDate, doi, ...extra })

const acc = [
  pub(1, 'Nail unit melanoma in adults', '2020-03-01', '10.1/ABC'),
  pub(2, 'Onychomycosis treatment outcomes across a decade', '2019-01-01'),
]

test('definite: DOI match ignores case and doi.org prefix', () => {
  const r = crossSourceDuplicates(acc, [ext('SCOPUS:2-s2.0-9', 'Something else', '2021', 'https://doi.org/10.1/abc')])
  assert.equal(r.length, 1)
  assert.equal(r[0].pub.pmid, 1)
  assert.equal(r[0].definite, true)
  assert.match(r[0].reason, /Same DOI/)
})

test('possible: same year and near-identical title, no shared id', () => {
  const r = crossSourceDuplicates(acc, [ext('OPENALEX:W5', 'Onychomycosis treatment outcomes across a decade.', '2019-06-01')])
  assert.equal(r.length, 1)
  assert.equal(r[0].definite, false)
})

test('not a duplicate: same title, different year; rejected externals skipped', () => {
  assert.equal(crossSourceDuplicates(acc, [ext('OPENALEX:W5', 'Onychomycosis treatment outcomes across a decade', '2022')]).length, 0)
  assert.equal(crossSourceDuplicates(acc, [ext('CROSSREF:10.1/abc', 'x', '2020', '10.1/abc', { suppressed: 1 })]).length, 0)
})

test('definite wins over an earlier possible match', () => {
  const two = [pub(3, 'Same title here', '2020-01-01'), pub(4, 'Other', '2020-01-01', '10.9/z')]
  const r = crossSourceDuplicates(two, [ext('CROSSREF:10.9/z', 'Same title here', '2020', '10.9/z')])
  assert.equal(r[0].pub.pmid, 4)
})

test('extSourceLabel', () => {
  assert.equal(extSourceLabel({ sourceType: 'OPENALEX' }), 'OpenAlex')
  assert.equal(extSourceLabel({ sourceType: '' }), 'Manual')
})

test('isMarkedDifferent: newest marker for that PMID wins', () => {
  const e = (note, t) => ({ feedback: 'PENDING', note, createTimestamp: t })
  assert.equal(isMarkedDifferent(undefined, 5), false)
  assert.equal(isMarkedDifferent([e(notDupNote(5), 10)], 5), true)
  assert.equal(isMarkedDifferent([e(notDupNote(5), 10)], 6), false)
  assert.equal(isMarkedDifferent([e(notDupNote(5), 10), e(reopenDupNote(5), 20)], 5), false)
  assert.equal(isMarkedDifferent([e(reopenDupNote(5), 10), e(notDupNote(5), 20), e('other', 30)], 5), true)
})
