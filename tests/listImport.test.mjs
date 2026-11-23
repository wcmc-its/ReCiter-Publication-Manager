// Unit tests for src/lib/listImport.ts ("Import a list", plan 2026-11-20-import-a-list-plan.md).
// Fixtures are SYNTHETIC (invented names and titles in the shapes of real Google Scholar,
// ResearchGate and Academia.edu pastes): this repo is public.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
    normTitle, titleSim, matchScore, bestMatch, chunkText, groundedInSource, sanitizeCitations,
    dedupePaste, detectFormat, parseStructured, parseCsvRows, groupAgainstRecord, cleanDoi, isUpdateNotice, sameWork, titleNumbers, isPreprintDoi, MAX_ITEMS, knownInRecord,
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

test('sanitizeCitations: drops ungrounded and malformed rows, tidies fields, does not cap (the dialog does, with a notice)', () => {
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
    assert.equal(items[0].doi, null, 'a DOI that is not in the pasted text is dropped')
    const withDoi = sanitizeCitations([{ title: 'Glial plumbing of the imaginary cortex', doi: '10.9999/FAKE.123' }], SCHOLAR + '\nhttps://doi.org/10.9999/fake.123')
    assert.equal(withDoi.items[0].doi, '10.9999/fake.123', 'a DOI in the paste is kept')
    const many = Array.from({ length: MAX_ITEMS + 5 }, () => ({ title: 'Glial plumbing of the imaginary cortex' }))
    assert.equal(sanitizeCitations(many, SCHOLAR).items.length, MAX_ITEMS + 5)
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

test('dedupePaste: same DOI and preprint/article pairs collapse; a Scholar junk twin is NOT merged', () => {
    const { items, deduped } = dedupePaste([
        { title: 'Consensus statement on fictional vascular disorders', venue: 'Stroke Imaginary 42 (9), 2672-2713', year: 2011 },
        { title: 'Committee on Things, Committee on Other Things …', venue: 'Stroke Imaginary 42 (9), 2672-2713', year: 2011 },
        { title: 'Hypertension-induced invented dysfunction at single-cell resolution', year: 2025 },
        { title: 'Hypertension-Induced Invented Dysfunction at Single-Cell Resolution', venue: 'Neuron Imaginary', year: 2025 },
        { title: 'Paper A', doi: '10.9999/x' },
        { title: 'Paper A (published version)', doi: '10.9999/x' },
        { title: 'A different work' },
    ])
    // 'Paper A' and 'Paper A (published version)' share a DOI but not a title: kept apart (a
    // misattached DOI must not merge two works); resolve's title check sorts them out.
    assert.equal(deduped, 1)
    assert.equal(items.length, 6)
    assert.ok(items.some((c) => c.venue === 'Neuron Imaginary'), 'the row with a venue is kept')
    assert.ok(items.some((c) => c.title.startsWith('Consensus statement')), 'the real title survives')
})

test('dedupePaste: different article-number papers with the same volume/pages line are both kept', () => {
    const { items } = dedupePaste([
        { title: 'Mapping widget expression across tissues', venue: 'Scientific reports 9 (1), 1-10', year: 2019 },
        { title: 'A deep learning model of gadget folding', venue: 'Scientific reports 9 (1), 1-10', year: 2019 },
    ])
    assert.equal(items.length, 2)
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

test('groupAgainstRecord: a low-scoring candidate never claims a record entry (wrong-PMID accept)', () => {
    const pubs = [{ pmid: 111, title: 'Another paper by the same author', year: 2020, status: 'PENDING' }]
    const exts = [{ articleId: 'CROSSREF:10.9/other', title: 'Some other external work', doi: '10.9/other', state: 'accepted' }]
    const rows = groupAgainstRecord([
        { title: 'A conference abstract on widget signalling', score: 0.35, match: m({ title: 'Another paper by the same author', pmid: 111 }) },
        { title: 'A second abstract nobody indexed', score: 0.4, match: m({ title: 'Some other external work', articleId: 'CROSSREF:10.9/other', doi: '10.9/other' }) },
    ], pubs, exts)
    assert.deepEqual(rows.map((r) => [r.group, r.pmid, r.checkable]), [['not_found', null, false], ['not_found', null, false]])
})

test('groupAgainstRecord: the title fallback never overrides a different PMID/DOI, and series numbers must agree', () => {
    const pubs = [{ pmid: 111, title: 'Long-term management of invented widget disorder: part 1', doi: '10.9/p1', year: 2020, status: 'PENDING' }]
    const part2 = { title: 'Long-term management of invented widget disorder: part 2', year: 2020, score: 1, match: m({ title: 'Long-term management of invented widget disorder: part 2', pmid: 222, doi: '10.9/p2', year: 2020 }) }
    const [r] = groupAgainstRecord([part2], pubs, [])
    assert.equal(r.group, 'pubmed_new')
    assert.equal(r.pmid, 222)
    // Even with no PMID or DOI from resolve, "part 2" is not "part 1"; "2019" is not "2018".
    const bare = { title: 'Long-term management of invented widget disorder: part 2', year: 2020, score: 0, match: null }
    assert.equal(groupAgainstRecord([bare], pubs, [])[0].group, 'not_found')
    assert.equal(sameWork('Invented society guidelines, 2018', 2018, 'Invented society guidelines, 2019', 2019), false)
    assert.equal(sameWork('Invented society guidelines part II', null, 'Invented society guidelines part III', null), false)
    assert.equal(sameWork('Glial plumbing of the imaginary cortex in 2014 cohorts', 2014, 'Glial Plumbing of the Imaginary Cortex in 2014 Cohorts.', 2014), true)
    assert.equal(sameWork('Glial plumbing of the imaginary cortex in 2014 cohorts and …', 2014, 'Glial plumbing of the imaginary cortex in 2014 cohorts and 3 more things', 2014), true)
})

test('groupAgainstRecord: a possible match to an accepted paper says so', () => {
    const pubs = [{ pmid: 7, title: 'Glial plumbing of the imaginary cortex', year: 2014, status: 'ACCEPTED' }]
    const [r] = groupAgainstRecord([{ title: 'Glial plumbing in imaginary cortices', score: 0.8, match: m({ title: 'Glial plumbing of the imaginary cortex', pmid: 7 }) }], pubs, [])
    assert.equal(r.group, 'in_profile')
    assert.match(r.note, /Possibly this one/)
})

test('dedupePaste: one DOI on two different titles keeps both; the same DOI and title merges', () => {
    assert.equal(dedupePaste([{ title: 'First distinct title about hearts', doi: '10.1001/x' }, { title: 'Second distinct title about lungs', doi: '10.1001/x' }]).items.length, 2)
    assert.equal(dedupePaste([{ title: 'First distinct title about hearts', doi: '10.1001/x' }, { title: 'First distinct title about hearts.', doi: '10.1001/x' }]).items.length, 1)
})

test('titleNumbers / sameWork: written forms agree, series numbers and letters do not', () => {
    const same = (a, b) => sameWork(a, 2020, b, 2020)
    assert.ok(same('COVID-19 and invented outcomes in widget patients', 'COVID19 and invented outcomes in widget patients'))
    assert.ok(same('(18)F-FDG PET/CT of invented widget lesions', '18F-FDG PET/CT of invented widget lesions'))
    assert.ok(same('\u00b9\u2078F-FDG PET/CT of invented widget lesions', '18F-FDG PET/CT of invented widget lesions'))
    assert.ok(same('IL-6 signaling in invented widget inflammation', 'IL6 signaling in invented widget inflammation'))
    assert.ok(same('Type 2 diabetes and invented widget outcomes', 'Type II diabetes and invented widget outcomes'))
    assert.ok(same('SARS-CoV-2 infection of invented widget cells', 'SARS-CoV2 infection of invented widget cells'))
    assert.ok(!same('Consensus recommendations for invented widget disorder: Part One', 'Consensus recommendations for invented widget disorder: Part Two'))
    assert.ok(!same('Consensus recommendations for invented widget disorder: Part A', 'Consensus recommendations for invented widget disorder: Part B'))
    assert.ok(!same('Consensus recommendations for invented widget disorder: part 1', 'Consensus recommendations for invented widget disorder: part 2'))
    assert.deepEqual(titleNumbers('What I learned at the first widget meeting'), [], 'a pronoun I or "first" outside a series word is not a number')
})

test('groupAgainstRecord: a preprint of an accepted article is the same work despite different DOIs', () => {
    assert.ok(isPreprintDoi('10.1101/2021.03.01.433000'))
    assert.ok(!isPreprintDoi('10.1016/j.neuron.2022.01.001'))
    const pubs = [{ pmid: 34000001, title: 'Invented widget circuits drive imaginary memory', doi: '10.1016/j.neuron.2022.01.001', year: 2022, status: 'ACCEPTED' }]
    const [r] = groupAgainstRecord([{ title: 'Invented widget circuits drive imaginary memory', year: 2021, score: 1, match: m({ title: 'Invented widget circuits drive imaginary memory', doi: '10.1101/2021.03.01.433000', year: 2021, record: { articleId: 'CROSSREF:10.1101/2021.03.01.433000' } }) }], pubs, [])
    assert.equal(r.group, 'in_profile')
    assert.equal(r.pmid, 34000001)
})

test('groupAgainstRecord: a pasted DOI that resolve rejected does not pick a record entry', () => {
    const pubs = [{ pmid: 999, title: 'Some other persons paper about kidneys', doi: '10.1001/victim', year: 2021, status: 'PENDING' }]
    const [r] = groupAgainstRecord([{ title: 'A conference abstract on widget signalling in mice', doi: '10.1001/victim', year: 2021, score: 0, match: null }], pubs, [])
    assert.equal(r.group, 'not_found')
    assert.equal(r.pmid, null)
})

test('sameWork: formatting-only differences match; letter-suffixed numbers stay distinct', () => {
    const same = (a, b) => sameWork(a, 2020, b, 2020)
    assert.ok(same('Mitochondrial H(2)O(2) emission in skeletal muscle of invented obese widgets', 'Mitochondrial H2O2 emission in skeletal muscle of invented obese widgets'))
    assert.ok(same('H(2)O(2) production by mitochondria in widget cells', 'H2O2 production by mitochondria in widget cells'))
    assert.ok(same('Plasma A-beta 1-42 and tau as predictors of invented decline', 'Plasma Aβ1-42 and tau as predictors of invented decline'))
    assert.ok(same('Plasma A-beta 1-42 and tau as predictors of invented decline', 'Plasma Aβ(1-42) and tau as predictors of invented decline'))
    assert.ok(!same('A phase 1a study of drug X in patients with advanced invented tumors', 'A phase 1b study of drug X in patients with advanced invented tumors'))
    assert.ok(!same('Structural basis of IL-17A recognition by an invented widget receptor', 'Structural basis of IL-17F recognition by an invented widget receptor'))
    assert.ok(!same('5-HT2A receptor signaling in invented widget neurons of the cortex', '5-HT2C receptor signaling in invented widget neurons of the cortex'))
    assert.ok(!same('Outcomes of stage 3A invented widget cancer after resection', 'Outcomes of stage 3B invented widget cancer after resection'))
    assert.ok(!sameWork('H2O2 production by mitochondria in widget cells', 2010, 'H2O2 production by mitochondria in widget cells', 2015), 'years far apart')
})

test('knownInRecord: accepted or external title hits skip lookup and still group as in_profile', () => {
    const pubs = [
        { pmid: 11, title: 'Invented lattice models of imaginary sleep', year: 2019, doi: '10.9999/a', status: 'ACCEPTED' },
        { pmid: 12, title: 'Synthetic widget pathways part 2', year: 2020, status: 'ACCEPTED' },
        { pmid: 13, title: 'Pending invented cortex atlas', year: 2021, status: 'PENDING' },
    ]
    const exts = [{ articleId: 'OPENALEX:W1', title: 'Fictional conference paper on widgets', year: 2018, state: 'accepted' }]
    const c = (title, year, doi) => ({ title, year, doi })
    assert.equal(knownInRecord(c('Invented lattice models of imaginary sleep', 2019), pubs, exts), true)
    assert.equal(knownInRecord(c('Invented lattice models of imaginary sleep', 2019, '10.9999/other'), pubs, exts), false) // different DOI
    assert.equal(knownInRecord(c('Synthetic widget pathways part 3', 2020), pubs, exts), false) // numbers differ
    assert.equal(knownInRecord(c('Pending invented cortex atlas', 2021), pubs, exts), false) // pending: needs lookup
    assert.equal(knownInRecord(c('Fictional conference paper on widgets', 2018), pubs, exts), true)
    assert.equal(knownInRecord(c('Invented lattice models of imaginary sleep', 2012), pubs, exts), false) // year off
    const rows = groupAgainstRecord([
        { ...c('Invented lattice models of imaginary sleep', 2019), score: 0, match: null },
        { ...c('Fictional conference paper on widgets', 2018), score: 0, match: null },
    ], pubs, exts)
    assert.deepEqual(rows.map((r) => r.group), ['in_profile', 'in_profile'])
})
