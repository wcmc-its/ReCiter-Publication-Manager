// Unit tests for src/lib/listImport.ts ("Import a list", plan 2026-11-20-import-a-list-plan.md).
// Fixtures are SYNTHETIC (invented names and titles in the shapes of real Google Scholar,
// ResearchGate and Academia.edu pastes): this repo is public.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
    normTitle, titleSim, matchScore, bestMatch, chunkText, groundedInSource, sanitizeCitations,
    dedupePaste, detectFormat, parseStructured, parseCsvRows, groupAgainstRecord, cleanDoi, isUpdateNotice, MAX_ITEMS,
} from '../src/lib/listImport.ts'

const SCHOLAR = `Cited by
VIEW ALL
Citations\t5120\t2210
2019
2020
2021
Jane Q. Example
Professor of Imaginary Medicine
TITLE
CITED BY
YEAR
Glial plumbing of the imaginary cortex: a new synthesis
JQ Example, R Placeholder
Journal of Fictional Neuroscience 12 (3), 101-118
812\t2014
Consensus statement on fictional vascular disorders: a report from the Society for Invented Medicine
P Author, JQ Example, ...
Stroke Imaginary 42 (9), 2672-2713
640\t2011
Committee on Things, Committee on Other Things, Council on Placeholder Studies and Council on …
P Author, JQ Example, ...
Stroke Imaginary 42 (9), 2672-2713
120\t2011
Articles 1–20SHOW MORE`

test('normTitle: case, punctuation and diacritics fold away', () => {
    assert.equal(normTitle('  Glial  Plumbing: the Café—Cortex! '), 'glial plumbing the cafe cortex')
    assert.equal(normTitle(null), '')
})

test('titleSim: equal titles are 1, a "…"-cut prefix is 1, unrelated titles are low', () => {
    assert.equal(titleSim('Glial plumbing of the imaginary cortex', 'Glial Plumbing of the Imaginary Cortex.'), 1)
    assert.equal(titleSim('Council on Placeholder Studies and Council on Invented …', 'Council on Placeholder Studies and Council on Invented Things, a statement'), 1)
    assert.ok(titleSim('Glial plumbing of the imaginary cortex', 'Dietary salt and invented outcomes') < 0.5)
    assert.ok(titleSim('Glial plumbing of the imaginary cortex', 'Glial plumbing of the imaginary cortex: a review') >= 0.85)
})

test('matchScore: more than a year apart costs 0.2; a preprint a year earlier does not', () => {
    const c = { title: 'Glial plumbing of the imaginary cortex', year: 2014 }
    assert.equal(matchScore(c, { title: c.title, year: 2015 }), 1)
    assert.ok(Math.abs(matchScore(c, { title: c.title, year: 2017 }) - 0.8) < 1e-9)
})

test('bestMatch: picks the most similar candidate', () => {
    const r = bestMatch({ title: 'Glial plumbing of the imaginary cortex' }, [
        { title: 'Something else entirely' }, { title: 'Glial plumbing of the imaginary cortex' }])
    assert.equal(r.score, 1)
    assert.equal(r.cand.title, 'Glial plumbing of the imaginary cortex')
})

test('chunkText: short text is one chunk; long text splits on lines and covers everything', () => {
    assert.deepEqual(chunkText('a\nb'), ['a\nb'])
    assert.deepEqual(chunkText('   '), [])
    const lines = Array.from({ length: 400 }, (_, i) => `Line ${i} ` + 'x'.repeat(60))
    const text = lines.join('\n')
    const chunks = chunkText(text, 5000, 300)
    assert.ok(chunks.length > 4)
    assert.ok(chunks.every((c) => c.length <= 5000))
    for (const l of lines) assert.ok(chunks.some((c) => c.includes(l)), 'every line lands in a chunk')
})

test('groundedInSource: an extracted title must be in the paste (first 50 characters)', () => {
    const src = normTitle(SCHOLAR)
    assert.ok(groundedInSource('Glial plumbing of the imaginary cortex: a new synthesis', src))
    // the model completing a "…"-cut title still passes
    assert.ok(groundedInSource('Committee on Things, Committee on Other Things, Council on Placeholder Studies and Council on Surgery', src))
    assert.ok(!groundedInSource('A paper the model invented about quantum gardening', src))
    assert.ok(!groundedInSource('2014', src), 'too short to trust')
})

test('sanitizeCitations: drops ungrounded and malformed rows, tidies fields, caps the list', () => {
    const raw = [
        { title: 'Glial plumbing of the imaginary cortex: a new synthesis', year: '2014', venue: 'Journal of Fictional Neuroscience 12 (3), 101-118', doi: 'https://doi.org/10.9999/FAKE.123.' },
        { title: 'Invented by the model', year: 2020 },
        'not an object',
        { year: 2011 },
    ]
    const { items, dropped } = sanitizeCitations(raw, SCHOLAR)
    assert.equal(items.length, 1)
    assert.equal(dropped, 3)
    assert.equal(items[0].year, 2014)
    assert.equal(items[0].doi, '10.9999/fake.123')
    const many = Array.from({ length: MAX_ITEMS + 5 }, () => ({ title: 'Glial plumbing of the imaginary cortex' }))
    assert.equal(sanitizeCitations(many, SCHOLAR).items.length, MAX_ITEMS)
})

test('isUpdateNotice: an erratum/correction record (update-to) is not a match candidate', () => {
    assert.equal(isUpdateNotice({ rawRecord: JSON.stringify({ title: ['X'], 'update-to': [{ type: 'erratum', DOI: '10.9/orig' }] }) }), true)
    assert.equal(isUpdateNotice({ rawRecord: JSON.stringify({ title: ['X'], 'update-to': [] }) }), false)
    assert.equal(isUpdateNotice({ rawRecord: JSON.stringify({ title: ['update-to in a title'] }) }), false)
    assert.equal(isUpdateNotice({ rawRecord: '{not json update-to' }), false)
    assert.equal(isUpdateNotice({}), false)
})

test('cleanDoi: finds a DOI in URL or prose, lowercases, trims trailing punctuation', () => {
    assert.equal(cleanDoi('doi: 10.1000/ABC.def).'), '10.1000/abc.def')
    assert.equal(cleanDoi('no doi here'), null)
})

test('dedupePaste: Scholar junk twin (same venue+pages), same DOI, and preprint/article pairs collapse', () => {
    const { items, deduped } = dedupePaste([
        { title: 'Consensus statement on fictional vascular disorders', venue: 'Stroke Imaginary 42 (9), 2672-2713', year: 2011 },
        { title: 'Committee on Things, Committee on Other Things …', venue: 'Stroke Imaginary 42 (9), 2672-2713', year: 2011 },
        { title: 'Hypertension-induced invented dysfunction at single-cell resolution', year: 2025 },
        { title: 'Hypertension-Induced Invented Dysfunction at Single-Cell Resolution', venue: 'Neuron Imaginary', year: 2025 },
        { title: 'Paper A', doi: '10.9999/x' },
        { title: 'Paper A (published version)', doi: '10.9999/x' },
        { title: 'A different work' },
    ])
    assert.equal(deduped, 3)
    assert.equal(items.length, 4)
    assert.ok(items.some((c) => c.venue === 'Neuron Imaginary'), 'the row with a venue is kept')
})

test('detectFormat + parseStructured: BibTeX', () => {
    const bib = `@article{example2014glial,
  title={Glial plumbing of the {imaginary} cortex},
  author={Example, Jane Q and Placeholder, R},
  journal={Journal of Fictional Neuroscience},
  year={2014},
  doi={10.9999/fake.1}
}
@inproceedings{p2,
  title = "A conference paper",
  booktitle = "Proc. Invented Conf",
  year = 2019
}`
    assert.equal(detectFormat(bib), 'bibtex')
    const rows = parseStructured(bib)
    assert.equal(rows.length, 2)
    assert.equal(rows[0].title, 'Glial plumbing of the imaginary cortex')
    assert.equal(rows[0].first_author, 'Example, Jane Q')
    assert.equal(rows[0].doi, '10.9999/fake.1')
    assert.equal(rows[1].venue, 'Proc. Invented Conf')
    assert.equal(rows[1].year, '2019')
})

test('detectFormat + parseStructured: RIS', () => {
    const ris = `TY  - JOUR\nTI  - Glial plumbing of the imaginary cortex\nAU  - Example, Jane\nPY  - 2014///\nJO  - Journal of Fictional Neuroscience\nDO  - 10.9999/fake.1\nER  - \nTY  - THES\nT1  - An invented thesis\nPY  - 2008\nER  - \n`
    assert.equal(detectFormat(ris), 'ris')
    const rows = parseStructured(ris)
    assert.equal(rows.length, 2)
    assert.equal(rows[0].year, '2014')
    assert.equal(rows[1].type, 'THES')
})

test('detectFormat + parseStructured: Scholar-style CSV with quoted commas', () => {
    const csv = 'Authors,Title,Publication,Volume,Number,Pages,Year,Publisher\n"Example, Jane; Placeholder, R","Glial plumbing, of the imaginary cortex",Journal of Fictional Neuroscience,12,3,101-118,2014,Invented Press\n'
    assert.equal(detectFormat(csv), 'csv')
    const rows = parseStructured(csv)
    assert.equal(rows.length, 1)
    assert.equal(rows[0].title, 'Glial plumbing, of the imaginary cortex')
    assert.equal(rows[0].year, '2014')
    assert.equal(rows[0].venue, 'Journal of Fictional Neuroscience')
    assert.deepEqual(parseCsvRows('a,"b ""q"""\n'), [['a', 'b "q"']])
})

test('detectFormat: a pasted Scholar page is free text', () => {
    assert.equal(detectFormat(SCHOLAR), 'text')
    assert.equal(parseStructured(SCHOLAR), null)
})

const m = (o) => ({ title: o.title, year: o.year ?? null, doi: o.doi ?? null, pmid: o.pmid ?? null, articleId: o.articleId ?? null, record: o.record ?? null })

test('groupAgainstRecord: each status lands in its group with the right default', () => {
    const pubs = [
        { pmid: 1, title: 'Accepted paper title here', doi: '10.9/a', year: 2010, status: 'ACCEPTED' },
        { pmid: 2, title: 'Suggested paper title here', year: 2011, status: 'PENDING' },
        { pmid: 3, title: 'Rejected paper title here', year: 2012, status: 'REJECTED' },
        // PubMed's DOI search missed this one: matched by title + year only.
        { pmid: 4, title: 'The science of invented things: mechanisms in search of treatments', year: 2010, status: 'ACCEPTED' },
    ]
    const exts = [
        { articleId: 'CROSSREF:10.9/ext', title: 'An external work already added', doi: '10.9/ext', state: 'accepted' },
        { articleId: 'OPENALEX:W1', title: 'A rejected external work', state: 'rejected' },
    ]
    const items = [
        { title: 'Accepted paper title here', score: 1, match: m({ title: 'Accepted paper title here', pmid: 1, doi: '10.9/a' }) },
        { title: 'Suggested paper title here', score: 1, match: m({ title: 'Suggested paper title here', pmid: 2 }) },
        { title: 'Rejected paper title here', score: 1, match: m({ title: 'Rejected paper title here', pmid: 3 }) },
        { title: 'The science of invented things: mechanisms in search of treatments', year: 2010, score: 1, match: m({ title: 'The science of invented things: mechanisms in search of treatments', doi: '10.9/neuron', year: 2010 }) },
        { title: 'A new PubMed paper', score: 0.95, match: m({ title: 'A new PubMed paper', pmid: 99 }) },
        { title: 'A conference abstract', score: 1, match: m({ title: 'A conference abstract', doi: '10.9/abs', articleId: 'CROSSREF:10.9/abs', record: { articleId: 'CROSSREF:10.9/abs' } }) },
        { title: 'An external work already added', score: 1, match: m({ title: 'An external work already added', doi: '10.9/EXT' }) },
        { title: 'A rejected external work', score: 0.92, match: m({ title: 'A rejected external work', articleId: 'OPENALEX:W1' }) },
        { title: 'Maybe this thesis', score: 0.8, match: m({ title: 'Maybe this thesis, revised', articleId: 'OPENALEX:W2', record: { articleId: 'OPENALEX:W2' } }) },
        { title: 'Nothing like it anywhere', score: 0.3, match: m({ title: 'Something else' }) },
        { title: 'Lookup blew up', score: 0, match: null, error: 'lookup HTTP 503' },
        { title: 'A new PubMed paper (again)', score: 0.95, match: m({ title: 'A new PubMed paper', pmid: 99 }) },
    ]
    const rows = groupAgainstRecord(items, pubs, exts)
    const g = rows.map((r) => r.group)
    assert.deepEqual(g, ['in_profile', 'suggestion', 'rejected', 'in_profile', 'pubmed_new', 'external', 'in_profile', 'in_profile', 'external', 'not_found', 'error', 'in_profile'])
    assert.equal(rows[3].pmid, 4, 'title+year fallback finds the accepted PMID')
    assert.equal(rows[1].checkedByDefault, true)
    assert.equal(rows[2].checkedByDefault, false, 'rejected: shown unchecked')
    assert.equal(rows[2].checkable, true)
    assert.equal(rows[7].note, 'Rejected earlier in All sources')
    assert.equal(rows[8].possible, true)
    assert.equal(rows[8].checkedByDefault, false, 'possible match: shown unchecked')
    assert.equal(rows[11].note, 'Listed twice in the paste')
    assert.equal(rows[9].pmid, null, 'a rejected candidate leaves no id on a not-found row')
    assert.equal(rows[9].match, null)
    assert.ok(rows.filter((r) => r.checkable).every((r) => r.group !== 'in_profile'))
})

test('groupAgainstRecord: an un-addable record (id too long) is not offered', () => {
    const rows = groupAgainstRecord([{ title: 'Long DOI work', score: 1, match: m({ title: 'Long DOI work', record: { articleId: 'CROSSREF:x', notAddable: 'too long' } }) }], [], [])
    assert.equal(rows[0].group, 'not_found')
    assert.equal(rows[0].note, 'too long')
})
