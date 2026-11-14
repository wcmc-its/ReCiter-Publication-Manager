// Unit tests for src/utils/manualEntry.ts (the 3d manual entry Dialog: fields by type, validation,
// the record body and edit patch, lookups, the person's position) and its round trip through
// src/lib/externalRecordShape.ts (what the store would write and read back). Run with `npm test`.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'

registerHooks({
  resolve(spec, ctx, next) {
    try { return next(spec, ctx) } catch (e) {
      if (spec.startsWith('.') && !/\.[cm]?[jt]s$/.test(spec)) return next(spec + '.ts', ctx)
      throw e
    }
  },
})
const M = await import('../src/utils/manualEntry.ts')
const { recordFromInput, apiRecordOf } = await import('../src/lib/externalRecordShape.ts')
const { checkExternalDup } = await import('../src/lib/externalDupCheck.ts')

const form = (patch = {}) => ({ ...M.MAN_EMPTY, ...patch })
const keys = (type, extra = {}) => M.manFieldsFor(form({ type, ...extra })).map((s) => s.key)

test('fields by type: journal default, book chapter, edited works, NPRW has no peer review', () => {
  assert.deepEqual(keys('Academic Article'), ['title', 'authors', 'role', 'year', 'month', 'journal', 'volume', 'issue', 'pages', 'doi', 'pr'])
  assert.deepEqual(keys('Book Chapter'), ['title', 'authors', 'role', 'year', 'month', 'journal', 'eds', 'publisher', 'place', 'pages', 'isbn', 'doi', 'pr'])
  const edited = M.manFieldsFor(form({ type: 'Edited Book' }))
  assert.equal(edited.find((s) => s.key === 'authors').label, 'Editors')
  assert.ok(!keys('Non-Peer-Reviewed Writing').includes('pr'))
  assert.ok(keys('Educational Material').includes('audience'))
  assert.ok(keys('Educational Material').includes('kind'))
  assert.ok(!keys('Academic Article').includes('kind'))
  assert.equal(M.manFieldsFor(form({ type: 'Book' }), 'Michael').find((s) => s.key === 'role').label, "Michael's role")
})

test('living entry: only Reference Entry, relabels the year and adds Last updated', () => {
  assert.ok(!keys('Reference Entry').includes('updated'))
  const living = M.manFieldsFor(form({ type: 'Reference Entry', living: 'yes' }))
  assert.equal(living.find((s) => s.key === 'year').label, 'First published (year)')
  assert.ok(living.some((s) => s.key === 'updated'))
  assert.ok(!keys('Book', { living: 'yes' }).includes('updated'))
})

test('validation: required by type, year, month/day, DOI, ISBN, YYYY-MM', () => {
  const e = M.validateForm(form())
  assert.equal(e.title, 'Required'); assert.equal(e.authors, 'Required'); assert.equal(e.year, 'Required'); assert.equal(e.journal, 'Required')
  assert.equal(M.validateForm(form({ type: 'Non-Peer-Reviewed Writing' })).kind, 'Pick one')
  const ok = form({ title: 'T', authors: 'A B', year: '2024', journal: 'J' })
  assert.deepEqual(M.validateForm(ok), {})
  assert.equal(M.validateForm({ ...ok, year: '24' }).year, 'Four-digit year')
  assert.ok(M.validateForm({ ...ok, month: '13' }).month)
  assert.ok(M.validateForm({ ...ok, month: '02-30' }).month)
  assert.equal(M.validateForm({ ...ok, month: '02-29', year: '2024' }).month, undefined)
  assert.ok(M.validateForm({ ...ok, doi: 'not a doi' }).doi)
  assert.equal(M.validateForm({ ...ok, doi: 'https://doi.org/10.1000/xyz' }).doi, undefined)
  assert.ok(M.validateForm({ ...ok, type: 'Book', publisher: 'P', isbn: '978-1-78330-542-2' }).isbn)
  assert.equal(M.validateForm({ ...ok, type: 'Book', publisher: 'P', isbn: '978-1-78330-542-1' }).isbn, undefined)
  assert.ok(M.validateForm({ ...ok, type: 'Reference Entry', living: 'yes', updated: '2024/3' }).updated)
  assert.ok(M.validateForm({ ...ok, type: 'Bogus' }).type)
})

test('date precision follows what was entered', () => {
  assert.equal(M.pubDateOf({ year: '2025', month: '' }), '2025')
  assert.equal(M.pubDateOf({ year: '2025', month: '3' }), '2025-03')
  assert.equal(M.pubDateOf({ year: '2025', month: '03/10' }), '2025-03-10')
  assert.equal(recordFromInput({ sourceType: 'MANUAL', pubDate: '2025-03' }).date_precision, 'MONTH')
})

test('role and peer review: NULL when the default, explicit when changed; NPRW never peer reviewed', () => {
  const base = form({ title: 'T', authors: 'A B', year: '2024', journal: 'J' })
  let b = M.recordBodyOf(base)
  assert.equal(b.role, null); assert.equal(b.peerReviewed, null)
  b = M.recordBodyOf({ ...base, role: 'Translator', pr: 'Not peer-reviewed' })
  assert.equal(b.role, 'Translator'); assert.equal(b.peerReviewed, false)
  assert.equal(M.recordBodyOf({ ...base, type: 'Edited Book', publisher: 'P', role: 'Editor' }).role, null)
  assert.equal(M.recordBodyOf({ ...base, type: 'Non-Peer-Reviewed Writing', kind: 'Blog post', pr: 'Peer-reviewed' }).peerReviewed, null)
  assert.equal(M.effectivePr({ type: 'Non-Peer-Reviewed Writing', journal: '', pr: 'Peer-reviewed' }), false)
  assert.equal(M.effectivePr({ type: 'Educational Material', journal: 'MedEdPORTAL', pr: '' }), true)
})

test('body: hidden fields are dropped, rare fields go to fields_json, venue falls back to the publisher', () => {
  const f = form({ type: 'Book', title: 'B', authors: 'Michael E Bales; Paul J Albert', target: 1, year: '2024', publisher: 'Facet', place: 'London', edition: '2nd', journal: 'left over', volume: '9' })
  const b = M.newManualBody(f, { detailsFrom: 'Crossref' })
  assert.equal(b.sourceType, 'MANUAL')
  assert.equal(b.journalOrVenue, 'Facet')
  assert.equal(b.volume, null)
  assert.deepEqual(b.fields, { place: 'London', edition: '2nd', detailsFrom: 'Crossref' })
  const ch = M.recordBodyOf(form({ type: 'Book Chapter', title: 'C', authors: 'X Y', year: '2024', journal: 'Book T', eds: 'E One; E Two', publisher: 'P' }))
  assert.deepEqual(ch.fields.editors, ['E One', 'E Two'])
  const edu = M.recordBodyOf(form({ type: 'Educational Material', title: 'E', authors: 'X Y', year: '2024', journal: 'MedEdPORTAL', kind: 'Module', audience: 'Students; Residents' }))
  assert.equal(edu.fields.kind, 'Module'); assert.equal(edu.fields.audience, 'Students; Residents')
  const ref = M.recordBodyOf(form({ type: 'Reference Entry', title: 'R', authors: 'X Y', year: '2020', journal: 'UpToDate', living: 'yes', updated: '2025-06' }))
  assert.equal(ref.fields.living, true); assert.equal(ref.fields.updated, '2025-06')
})

test('round trip: body -> external_record row -> API record -> form', () => {
  const f = form({
    type: 'Book Chapter', title: 'My chapter', authors: 'Mei Lin; Michael E Bales', target: 2, year: '2024', month: '05',
    journal: 'The Book', eds: 'Rachel Okafor; Simon T Vale', publisher: 'Facet', place: 'London', pages: '10-20',
    isbn: '978-1-78330-542-1', role: 'Translator', pr: 'Peer-reviewed',
  })
  const row = recordFromInput(M.newManualBody(f, { detailsFrom: 'Crossref' }))
  assert.match(row.article_id, /^MANUAL:[0-9a-f-]{36}$/)
  assert.equal(row.source_type, 'MANUAL')
  assert.equal(row.target_author_index, 2)
  assert.equal(row.byline, 'Lin M, ((Bales ME))')
  assert.equal(row.date_precision, 'MONTH')
  assert.equal(row.pub_type, 'Book Chapter')
  const api = apiRecordOf({ ...row, id: 7, uid: 'meb7002', status: 'ACCEPTED', added_by: 'paa2013', added_at: '2026-11-14T10:00:00Z' })
  const back = M.formFromRecord(api)
  for (const k of ['type', 'title', 'year', 'month', 'journal', 'eds', 'publisher', 'place', 'pages', 'isbn', 'role', 'pr']) assert.equal(back[k], f[k], k)
  assert.equal(back.authors, 'Mei Lin; Michael E Bales')
  assert.equal(back.target, 2)
  assert.deepEqual(M.editPatchOf(back, api), M.recordBodyOf(f, { detailsFrom: 'Crossref' }))
  assert.equal(M.manualProvenance(api).text, 'Added manually by paa2013 · Nov 14, 2026')
  assert.match(M.manualProvenance(api).tip, /with details from Crossref/)
})

test('the person: preselected by surname; none when not listed', () => {
  assert.equal(M.targetBySurname(['Mei Lin', 'Michael E Bales', 'Paul J Albert'], 'Bales'), 2)
  assert.equal(M.targetBySurname(['Mei Lin'], 'Bales'), null)
  assert.equal(M.targetBySurname(['John Smith Jr.'], 'Smith'), 1)
  const b = M.recordBodyOf(form({ authors: 'A B', target: 3 }))
  assert.equal(b.targetAuthorIndex, null)
})

test('lookup kinds', () => {
  assert.deepEqual(M.lookupKindOf('PMID: 24694772'), { kind: 'pmid', value: '24694772' })
  assert.deepEqual(M.lookupKindOf('https://doi.org/10.1016/j.acalib.2025.103012'), { kind: 'doi', value: '10.1016/j.acalib.2025.103012' })
  assert.deepEqual(M.lookupKindOf('978-1-78330-542-1'), { kind: 'isbn', value: '9781783305421' })
  assert.equal(M.lookupKindOf('some title words').kind, '')
})

test('Crossref prefill: article, a book found by ISBN becomes the chapter, the person\'s own book stays a book', () => {
  const art = M.formFromCrossref({
    title: 'Embedding bibliometric support', doi: '10.1016/j.acalib.2025.103012', journalOrVenue: 'J Acad Libr',
    authors: ['Michael E Bales', 'Mei Lin'], pubDate: '2025-03-10', publicationType: 'journal-article',
    rawRecord: JSON.stringify({ volume: '51', issue: '2', page: '103012', publisher: 'Elsevier' }),
  }, { personSurname: 'Bales' })
  assert.equal(art.form.type, 'Academic Article')
  assert.equal(art.form.year, '2025'); assert.equal(art.form.month, '03-10')
  assert.equal(art.form.volume, '51'); assert.equal(art.form.pages, '103012')
  assert.equal(art.form.target, 1)
  const bookRow = {
    title: 'Research Data and Bibliometrics', doi: '10.1/book', authors: [], pubDate: '2024', publicationType: 'edited-book',
    rawRecord: JSON.stringify({ editor: [{ given: 'Rachel', family: 'Okafor' }], publisher: 'Facet', 'publisher-location': 'London', ISBN: ['9781783305421'] }),
  }
  const ch = M.formFromCrossref(bookRow, { isbn: true, personSurname: 'Bales' })
  assert.equal(ch.form.type, 'Book Chapter')
  assert.equal(ch.form.journal, 'Research Data and Bibliometrics')
  assert.equal(ch.form.eds, 'Rachel Okafor')
  assert.equal(ch.form.title, '')
  assert.match(ch.note, /Found the book in Crossref/)
  const own = M.formFromCrossref({ ...bookRow, rawRecord: JSON.stringify({ editor: [{ given: 'Michael', family: 'Bales' }], publisher: 'Facet' }) }, { isbn: true, personSurname: 'Bales' })
  assert.equal(own.form.type, 'Edited Book'); assert.equal(own.form.authors, 'Michael Bales'); assert.equal(own.form.target, 1)
})

test('OpenAlex prefill: type map and biblio pages', () => {
  const p = M.formFromOpenAlex({
    title: 'Benchmarking', authors: ['Sarbajit Dutta', 'Michael E Bales'], pubDate: '2025-10-01', publicationType: 'preprint',
    journalOrVenue: 'arXiv', doi: '10.48550/arXiv.2510.11234', rawRecord: JSON.stringify({ biblio: { first_page: '1', last_page: '9' } }),
  }, { personSurname: 'Bales' })
  assert.equal(p.form.type, 'Preprint'); assert.equal(p.form.pages, '1-9'); assert.equal(p.form.target, 2)
})

test('server check of a manual body', () => {
  const ok = { pubType: 'Book', title: 'T', pubDate: '2024' }
  assert.equal(M.validateManualBody(ok), null)
  assert.match(M.validateManualBody({ ...ok, pubType: 'Novel' }), /type/)
  assert.match(M.validateManualBody({ ...ok, title: ' ' }), /title/)
  assert.match(M.validateManualBody({ ...ok, pubDate: '' }), /year/)
  assert.match(M.validateManualBody({ ...ok, doi: 'x' }), /DOI/)
  assert.match(M.validateManualBody({ ...ok, isbn: '123' }), /ISBN/)
  assert.match(M.validateManualBody({ ...ok, role: 'Boss' }), /role/)
  assert.equal(M.validateManualBody({ ...ok, pubDate: '2024-02-29' }), null)
  for (const d of ['2024-13', '2024-00', '2023-02-29', '2024-04-31']) assert.match(M.validateManualBody({ ...ok, pubDate: d }), /year/, d)
  assert.match(M.validateManualBody({ ...ok, pmid: 12345678 }, { create: true }), /PubMed/)
  assert.equal(M.validateManualBody({ ...ok, pmid: 12345678 }), null)
  assert.match(M.validateManualBody({ ...ok, pubType: 'Non-Peer-Reviewed Writing', peerReviewed: true }), /peer-reviewed/)
  assert.equal(M.validateManualBody({ ...ok, pubType: 'Non-Peer-Reviewed Writing', peerReviewed: null }), null)
})

test('a manual body meets the store duplicate check: DOI blocks, title+year warns', () => {
  const body = M.newManualBody(form({ title: 'Embedding bibliometric support in a library', authors: 'A B', year: '2025', journal: 'J', doi: '10.1000/abc' }))
  const rec = recordFromInput(body)
  const existing = [{ id: 1, article_id: 'CROSSREF:10.1000/abc', source_type: 'CROSSREF', status: 'ACCEPTED', doi: '10.1000/ABC', title: 'X', pub_date: '2025' }]
  assert.equal(checkExternalDup(rec, { existing }).level, 'BLOCKED')
  const t = [{ id: 2, article_id: 'SCOPUS:9', source_type: 'SCOPUS', status: 'ACCEPTED', doi: null, title: 'Embedding bibliometric support in a library.', pub_date: '2025-01-01' }]
  assert.equal(checkExternalDup(recordFromInput({ ...body, doi: null }), { existing: t }).level, 'WARNING')
  // The record being edited is left out by the store (dupCheck excludeId), so it never matches itself.
  assert.equal(checkExternalDup(rec, { existing: [] }).level, 'OK')
})

test('prefill text: HTML entities and tags decoded', () => {
  assert.equal(M.plainText('Knowledge Discovery &amp; Data <i>Mining</i> &#8211; KDD'), 'Knowledge Discovery & Data Mining – KDD')
  const p = M.formFromCrossref({ title: 'A &amp; B', journalOrVenue: 'Proc &amp; More', authors: [], publicationType: 'proceedings-article', pubDate: '2019' })
  assert.equal(p.form.title, 'A & B'); assert.equal(p.form.journal, 'Proc & More')
})
