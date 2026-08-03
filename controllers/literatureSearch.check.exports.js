/*
 * THE EXPORTS half of the Literature Search check — the .docx and the .xlsx that actually leave the
 * building.
 *
 * Handed the query, the row counts and the Embase run rather than recomputing any of them: the
 * property under test is that the appendix agrees with the panel, and a fresh count here could
 * differ for a reason that has nothing to do with the exporter.
 */
const assert = require('node:assert')
const { strategy } = require('./literatureSearch.check.fixtures')
const { requireCompiled } = require('./literatureSearch.check.harness')

const run = async ({ q, rc, rowsResult, embaseRun }) => {
    const s = strategy()

    // =======================================================================================
    // EXPORTS. An export that cannot be re-run is not evidence — so the thing worth pinning is that
    // every document carries the query, the count, the date, who ran it, and WHICH MODEL DRAFTED IT.
    //
    // Asserted over the BLOCKS, not over the rendered bytes. The blocks are what a document SAYS;
    // .docx is a zip, and grepping a zip for a PubMed query proves nothing. The renderer that turns
    // blocks into that zip is a different question and gets its own smoke test, below.

    const xp = requireCompiled('controllers/literatureExport.js')

    // Everything a document says, flattened — table cells INCLUDED, because the query, the count and
    // the model all live in the repro TABLE, not in a paragraph. Flatten only the paragraphs and
    // this whole section would pass while asserting nothing.
    const said = blocks => blocks.flatMap(b =>
        b.kind === 'table' ? [...b.head, ...b.rows.flat()] : [b.text]
    ).join('\n')

    // Prettified for the reader, but the PROFILE ID survives verbatim: the id pins the weights and
    // agrees with the Bedrock bill, the pretty name is what a reader understands, and a journal's AI
    // declaration wants both. An id this cannot parse must fall through UNCHANGED rather than vanish
    // — a missing model name beats a wrong one.
    assert.strictEqual(xp.modelLabel('us.anthropic.claude-opus-4-8'), 'Claude Opus 4.8, via AWS Bedrock')
    assert.strictEqual(xp.modelLabel('anthropic.claude-sonnet-4-5'), 'Claude Sonnet 4.5, via AWS Bedrock')
    assert.strictEqual(xp.modelLabel('some-model-we-have-never-seen'), 'some-model-we-have-never-seen')
    assert.strictEqual(xp.modelLabel(''), '')

    // THE FULL-LENGTH IDS, which is what BEDROCK_MODEL_ID actually holds the moment anyone pins a
    // profile instead of taking the floating alias. Every id below is a REAL, ACTIVE profile in the
    // account (aws bedrock list-inference-profiles). The version must stop before the release date
    // and before the -vN revision — a regex that reads "digits and hyphens" swallows both and prints
    // "Claude Opus 4.5.20251101." into the AI declaration of every export. There is no error worse
    // than an invented model version, because it is indistinguishable from a real one.
    assert.strictEqual(xp.modelLabel('us.anthropic.claude-opus-4-8-v1:0'), 'Claude Opus 4.8, via AWS Bedrock')
    assert.strictEqual(xp.modelLabel('us.anthropic.claude-opus-4-5-20251101-v1:0'), 'Claude Opus 4.5, via AWS Bedrock')
    assert.strictEqual(xp.modelLabel('us.anthropic.claude-sonnet-4-5-20250929-v1:0'), 'Claude Sonnet 4.5, via AWS Bedrock')
    assert.strictEqual(xp.modelLabel('global.anthropic.claude-haiku-4-5-20251001-v1:0'), 'Claude Haiku 4.5, via AWS Bedrock')
    assert.strictEqual(xp.modelLabel('us.anthropic.claude-opus-4-6-v1'), 'Claude Opus 4.6, via AWS Bedrock')
    // A one-part version is a version: Sonnet 4 is not Sonnet 4.20250514.
    assert.strictEqual(xp.modelLabel('us.anthropic.claude-sonnet-4-20250514-v1:0'), 'Claude Sonnet 4, via AWS Bedrock')
    assert.strictEqual(xp.modelLabel('us.anthropic.claude-sonnet-5'), 'Claude Sonnet 5, via AWS Bedrock')

    // THE FALLBACK, which is the whole safety property: an id whose shape we do not recognize gets
    // NO pretty name rather than a guessed one. Legacy claude-3 ids put the generation before the
    // family (claude-3-5-sonnet), so they do not parse — and printing the raw id is the correct,
    // honest outcome. The id is the half that had to be right anyway.
    assert.strictEqual(xp.modelLabel('anthropic.claude-3-5-sonnet-20240620-v1:0'), 'anthropic.claude-3-5-sonnet-20240620-v1:0')
    assert.strictEqual(xp.modelLabel('us.anthropic.claude-3-haiku-20240307-v1:0'), 'us.anthropic.claude-3-haiku-20240307-v1:0')
    // An unrecognized SUFFIX must also fall through whole — never a truncated guess.
    assert.strictEqual(xp.modelLabel('us.anthropic.claude-opus-4-8-preview'), 'us.anthropic.claude-opus-4-8-preview')

    // And the id itself survives verbatim in the disclosure, whatever the label does.
    for (const id of ['us.anthropic.claude-opus-4-5-20251101-v1:0', 'anthropic.claude-3-5-sonnet-20240620-v1:0']) {
        const decl = said(xp.strategyDoc(
            { concepts: [{ label: 'P', lines: [{ terms: 'probiotics[tiab]', on: true }] }],
              limits: '', query: 'probiotics[tiab]', hits: 122, runDate: '2026-07-13', seeds: [] },
            'Q?', 'paa2013', id,
        ))
        assert.ok(decl.includes(id), `the profile id must survive verbatim in the declaration: ${id}`)
        assert.ok(!/\d{8}\./.test(decl), `a release date must never be printed as a version: ${id}`)
    }

    // THE REPRODUCIBILITY INVARIANT. A synthesis pasted into a manuscript without the query behind
    // it is an anecdote with citations — and "AI-assisted" with no model version is not a
    // declaration. This is the assertion that says both out loud.
    const facts = {
        query: 'probiotics[tiab] AND depression[tiab]', hits: 122, runDate: '2026-07-13',
        retrieved: 50, sort: 'most relevant',
        cwid: 'paa2013', model: 'us.anthropic.claude-opus-4-8',
    }
    const doc = said(xp.synthesisDoc(
        { table: [{ pmid: '37314797', study: 'Nikolova et al.', year: '2023', journal: 'JAMA Psychiatry', design: 'RCT', intervention: 'Probiotic vs placebo' }],
          prose: 'Probiotics reduced symptoms [PMID 37314797].', floor: 'The strongest evidence retrieved is a randomized controlled trial.' },
        facts, 'Do probiotics help depression?', { pico: true, screenedIn: 1, screenedOf: 50 },
    ))
    for (const must of ['probiotics[tiab] AND depression[tiab]', '122', '2026-07-13', '37314797', 'paa2013',
                        'Claude Opus 4.8', 'us.anthropic.claude-opus-4-8']) {
        assert.ok(doc.includes(must),
            `the exported document must carry "${must}" — an export that cannot be re-run is not evidence`)
    }

    // THE YIELD IS NOT THE RETRIEVED COUNT, and a methods table that says it is will be copied
    // straight into a PRISMA flow diagram. This document retrieves the top 50 of 122 and screens
    // them; the closing line already says "1 of 50 retrieved records", so a header reading
    // "Records retrieved: 122" contradicts its own document — and 122 is the number a co-author
    // would write down. Both numbers, named for what they are.
    assert.ok(doc.includes('Records identified by the query'),
        'the yield must be labelled as the yield, never as the number of records retrieved')
    assert.ok(/top 50 of 122, ranked by most relevant/.test(doc),
        'a capped, ranked slice must DECLARE the cap and the ranking in the methods, not only on screen')
    assert.ok(!/Records retrieved\D+122/.test(doc),
        'the 122 hits must never be printed under the word "retrieved" — only 50 records were')
    // Mode 1 counts and never retrieves, so it keeps its single row and gains no cap sentence.
    const mode1 = said(xp.strategyDoc(
        { concepts: [{ label: 'P', lines: [{ terms: 'probiotics[tiab]', on: true }] }], limits: '', query: 'q', hits: 122, runDate: '2026-07-13', seeds: [] },
        'Q?', 'paa2013', 'us.anthropic.claude-opus-4-8',
    ))
    assert.ok(!/top \d+ of/.test(mode1), 'Mode 1 retrieves nothing, so it must not claim a retrieved slice')

    // A FABRICATED CITATION MUST TRAVEL WITH THE DOCUMENT. The server already detects a PMID the
    // model was never given; for a while it only console.error'd it and exported the clickable link
    // anyway. The .docx is the copy that gets mailed to a co-author, so the warning belongs IN it —
    // and above the prose, not in a footnote under it.
    const dirty = said(xp.synthesisDoc(
        { table: [], prose: 'Probiotics reduced symptoms [PMID 99999999].', invented: ['99999999'] },
        facts, 'Q?', { pico: false, screenedIn: 1, screenedOf: 50 },
    ))
    assert.ok(/WARNING/.test(dirty) && dirty.includes('99999999'),
        'a synthesis citing a PMID outside the evidence set must say so IN the exported document')
    assert.ok(dirty.indexOf('WARNING') < dirty.indexOf('Probiotics reduced symptoms'),
        'the warning must sit ABOVE the prose it contaminates — a reader must not reach the claim first')
    assert.ok(!/WARNING/.test(doc), 'a clean synthesis must carry no warning')
    console.log('synthesis:    an invented citation is flagged on the wire, on screen, and above the prose in the .docx')

    // The strategy export must describe the TOGGLED state, never the model's draft: an unticked line
    // was not searched, so it must not appear in a methods section that claims it was.
    const strategyBlocks = xp.strategyDoc({
        concepts: [
            { label: 'Probiotics', lines: [{ terms: 'probiotics[tiab]', on: true }, { terms: 'SHOULD-NOT-APPEAR[tiab]', on: false }] },
            { label: 'Depression', lines: [{ terms: 'depression[tiab]', on: true }] },
        ],
        limits: '', query: 'q', hits: 5, runDate: '2026-07-13',
        seeds: [{ id: '1', kind: 'pmid', retrieved: false, label: 'Smith 2020', missReason: 'Depression block' }],
    }, 'Q?', 'paa2013', 'us.anthropic.claude-opus-4-8')
    const sDoc = said(strategyBlocks)
    assert.ok(!sDoc.includes('SHOULD-NOT-APPEAR'), 'an UNTICKED line was never searched and must not appear in the methods')
    assert.ok(sDoc.includes('Depression block'), 'a missed seed must carry its derived reason into the appendix')
    // THE DISCLOSURE PEOPLE FORGET. Mode 1's QUERY is model-drafted too, not only Mode 2's prose —
    // and this export IS the PRISMA-S appendix, so if the disclosure is not here it is nowhere.
    assert.ok(sDoc.includes('us.anthropic.claude-opus-4-8'),
        'the SEARCH STRATEGY export must disclose the model that drafted the query, not only the synthesis')

    // THE RESULTS COLUMN, ACTUALLY PRINTED. Everything asserted about the row counts further up was
    // asserted about the MAP; the appendix is where a PRESS reviewer reads them. Until this, no check
    // ever handed the map to the exporter — every strategyDoc() call passed no rowCounts — so the
    // Records column was only exercised on its BLANK branch, and a column that printed every count one
    // line out of place would have gone green.
    //
    // A LINE NUMBER DOES NOT NAME A STABLE QUERY (the re-keying asserted at the top of this file), so
    // "the right number appeared" is not the property worth checking — "each count is on ITS OWN line"
    // is. Read the count back at the number the EXPORT derived, not at the number we counted with.
    // The last row is the anchor: it IS the whole search, so its cell must equal the yield printed in
    // the header above it, or the appendix and the panel are describing different queries.
    const counted = xp.strategyDoc(
        { ...s, query: q, hits: rowsResult.hits, runDate: '2026-07-13', seeds: [], rowCounts: rc },
        'Do probiotics help depression?', 'paa2013', 'us.anthropic.claude-opus-4-8',
    )
    const recordsTable = counted.find(b => b.kind === 'table' && b.head[2] === 'Records')
    assert.ok(recordsTable, 'the strategy appendix must carry a Records column')
    assert.strictEqual(recordsTable.rows.length, Object.keys(rc).length,
        'every counted line reaches the appendix — a line the librarian searched and cannot see the yield of is half an appendix')
    for (const [n, , records] of recordsTable.rows) {
        assert.strictEqual(records, rc[Number(n)].toLocaleString(),
            `line ${n} must print ITS OWN count (${rc[Number(n)]}), not some other line's`)
    }
    assert.strictEqual(
        recordsTable.rows[recordsTable.rows.length - 1][2], rowsResult.hits.toLocaleString(),
        'the last line of the appendix IS the search: its count must equal the yield in the header above it',
    )
    console.log(`records col:  ${recordsTable.rows.length} lines printed, each carrying its own count; last line == yield (${rowsResult.hits.toLocaleString()})`)

    // EMBASE (OVID): THE EXPORT IS THE ARTIFACT THAT LEAVES THE BUILDING, so it is the thing that has
    // to say the strategy was DRAFTED and never RUN. `hits` is null here, and both of the obvious
    // coercions are fabrications in a methods table: String(null) is the word "null", Number(null) is
    // 0 — and "Records identified by the query: 0" beside a perfectly good strategy reads, to a reader
    // who was not in the room, as "this search found nothing."
    assert.ok(embaseRun, 'the Embase dialect section must have run before the exports section')
    const eDoc = said(xp.strategyDoc(
        { ...embaseRun.run, db: 'embase', unsupportedLimits: embaseRun.unsupported },
        'Do probiotics help depression?', 'paa2013', 'us.anthropic.claude-opus-4-8',
    ))
    // `said` emits one line per table CELL, so the yield is the line straight after its label. Assert
    // on THAT cell, not on a loose window — a regex that runs past the newline sweeps up other cells
    // and passes (or fails) for reasons that have nothing to do with the yield.
    const eLines = eDoc.split('\n')
    const eYield = eLines[eLines.findIndex(l => /^Records identified by the query$/i.test(l)) + 1]
    assert.ok(/^Not counted/i.test(eYield),
        `the yield cell must SAY it was not counted, got: ${JSON.stringify(eYield)}`)
    assert.ok(!/^\s*(0|null)\s*$/i.test(eYield),
        'an uncounted database must never print 0 or "null" as its yield — that reads as "found nothing"')
    assert.ok(/ON ITS OWN/i.test(eDoc),
        'we cannot detect a dead Emtree heading, so the export must tell the librarian how to find one')
    assert.ok(/Limits panel/i.test(eDoc),
        'Ovid CAN apply these limits, in its own panel — do not tell a librarian it cannot')
    console.log('embase export: declares DRAFTED-not-run, prints no 0/null yield, tells the librarian to test each Emtree line')

    // THE RENDERER. Word is the delivery format, so a Block[] it cannot render is a download button
    // that throws in a librarian's face. Packer really zips it — a .docx is a zip, so it opens PK.
    const { Packer } = require('docx')
    const { docxDoc } = requireCompiled('controllers/literatureDocx.js')
    const buf = await Packer.toBuffer(docxDoc([...strategyBlocks, ...xp.synthesisDoc(
        { table: [], prose: 'p' }, facts, 'Q?', { pico: false, screenedIn: 0, screenedOf: 0 },
    ), { kind: 'spacer' }]))
    assert.ok(buf.length > 1000 && buf[0] === 0x50 && buf[1] === 0x4b,
        'a .docx is a zip and must open with PK — Word will not read anything else')

    // ...AND WORD MUST SEE THE PARAGRAPHS. A .docx that OPENS is not a .docx that READS. OOXML has no
    // line break inside <w:t>, so a raw \n there is whitespace — Word renders it as a space — and the
    // model's 3-5 paragraph answer (bottom line / supporting evidence / what this does not establish)
    // used to arrive as one grey slab. The screen split it; the FILE, which is the thing that leaves
    // the building, did not. So assert on the emitted XML, not on the zip magic.
    //
    // jszip arrives with docx and is only used to READ the output back. If a docx bump ever drops it,
    // skip loudly rather than fail: a missing test-only dep is not a broken export.
    let JSZip = null
    try { JSZip = require('jszip') } catch { /* below */ }
    if (!JSZip) {
        console.log('docx:         SKIPPED the paragraph check — jszip (a docx dependency) is not resolvable')
    } else {
        const slab = await Packer.toBuffer(docxDoc([
            { kind: 'p', text: 'Bottom line.\n\nThe supporting evidence.\n\nWhat this does not establish.' },
        ]))
        const xml = await (await JSZip.loadAsync(slab)).file('word/document.xml').async('string')
        assert.strictEqual((xml.match(/<w:p[ >]/g) || []).length, 3,
            'a 3-paragraph synthesis must emit 3 Word paragraphs — one slab of newlines is not a document')
        assert.ok(!/<w:t[^>]*>[^<]*\n/.test(xml),
            'no raw newline may survive inside a <w:t>: Word reads it as a space, not a break')
        console.log('docx:         a multi-paragraph synthesis emits real Word paragraphs, not one slab')
    }

    // The spreadsheet: a null iCite percentile is NOT a zero. Number(null) === 0, and a confident
    // "0" against a brand-new trial is a scarlet letter we invented.
    const sheets = xp.recordSheets(
        [{ pmid: '1', title: 'T', authors: 'A', year: '2024', journal: 'J', design: 'RCT', tier: { rank: 3 } }],
        {}, {}, facts,
    )
    const pctCol = sheets[0].head.indexOf('NIH percentile')
    assert.strictEqual(sheets[0].rows[0][pctCol], '', 'an absent percentile exports as blank, never as 0')
    assert.ok(sheets.some(s => s.name === 'Search'), 'the data file carries the query with it, or it cannot be accounted for later')
    console.log('exports:      query/count/date/who/MODEL carried (strategy too); unticked lines excluded; null pct stays blank; .docx renders')
}

module.exports = { run }
