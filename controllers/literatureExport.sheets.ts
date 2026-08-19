// The .xlsx sheets (shape only; exceljs renders them client-side). Split out of
// literatureExport.ts (barrel).
import { DIALECTS, Db } from './literatureSearch.strategy'
import { RunFacts, modelDisclosure } from './literatureExport.blocks'

// ---------------------------------------------------------------------------
// Spreadsheets. Shape only — exceljs turns these into a workbook in the client, where it is
// dynamically imported so the 600KB library costs nothing until someone actually clicks Download.

export type Sheet = { name: string; head: string[]; rows: Array<Array<string | number>> }

export type RecordLike = {
    pmid: string; title: string; authors: string; year: string; journal: string
    design: string; tier?: { rank: number }; nihPercentile?: number
}

// WHY A TRUNCATED SHEET CARRIES NO AI VERDICT COLUMN — this is a MEASURED result, not a precaution.
//
// We ran three published Cochrane reviews whose included studies are known through Mode 1 against live
// PubMed and Bedrock (controllers/literatureSearch.recall.js; full write-up in docs/RECALL-STUDY.md):
//
//   the STRATEGY retrieved 72 of 73 known-included studies       — 99%. It is genuinely good.
//   the TOP 50 BY RELEVANCE contained 1 of those 72              —  1%.
//
// A known-good study ranks around 300th of several thousand by PubMed relevance. Relevance ranking is
// not built to float the primary studies a systematic review would include, and it does not. So the
// records in a truncated sheet are very nearly DISJOINT from the studies the reviewer is looking for.
//
// The AI screen is not the problem — it kept the one gold study that ever reached it. The problem is
// that an "AI suggested / Include / Exclude" column on this sheet makes a claim about a population the
// model was never shown. This .xlsx is opened in COVIDENCE, by someone who never saw our UI and cannot
// know the sample was cut, and there it is treated AS A SCREENING PASS. A column that reads "Exclude"
// beside 50 records — out of 27,000 that the librarian's own strategy correctly matched — is not a
// screen; it is a screen-shaped object, and the sensitivity it silently costs is the exact harm this
// feature was built to prevent.
//
// So when the sheet is truncated the verdict columns are REFUSED outright, rather than labelled and
// hoped about. The strategy and the records still ship — the strategy is the good half, and it is what
// Covidence actually wants. The full 50-of-N sample remains available on screen as triage.
// If a full-yield screen is ever wanted, the fix is not a bigger cap (at 500 records we still lost half
// the diagnostic review's studies, at 10x the cost) — it is to stop ranking by relevance.
const truncated = (f: RunFacts) => f.hits !== null && f.retrieved !== undefined && f.retrieved < f.hits

export function recordSheets(
    records: RecordLike[],
    // `screened: false` means NO MODEL EVER READ THIS RECORD — it failed open, so it arrives with
    // include: true. Without that field here, the "AI suggested" column prints it as an AI `Include`:
    // an endorsement no model gave, in the file that goes to Covidence and gets screened against.
    // The field was already in the objects the page passes down; this signature is what was dropping it.
    flags: Record<string, { include: boolean; reason: string; screened?: boolean }>,
    picked: Record<string, boolean>,
    facts: RunFacts,
): Sheet[] {
    const cut = truncated(facts)
    return [
        {
            name: 'Records',
            head: ['PMID', 'Title', 'Authors', 'Year', 'Journal', 'Design', 'Evidence rank',
                'NIH percentile', 'Selected by human',
                ...(cut ? [] : ['AI suggested', 'AI reason']),
                'Link'],
            rows: records.map(r => [
                r.pmid, r.title, r.authors, r.year, r.journal, r.design,
                r.tier?.rank ?? '',
                // A null percentile is NOT a zero. Never coerce it — Number(null) === 0, and a
                // confident "0th percentile" on a brand-new trial is a scarlet letter we invented.
                typeof r.nihPercentile === 'number' ? r.nihPercentile : '',
                picked[r.pmid] ? 'Yes' : 'No',
                ...(cut ? [] : [
                    // Three states, not two. An exclusion is a judgment, an include is a judgment, and
                    // an unscreened record is the ABSENCE of one — it must not borrow the word for either.
                    flags[r.pmid]
                        ? (flags[r.pmid].screened === false
                            ? 'Not screened'
                            : flags[r.pmid].include ? 'Include' : 'Exclude')
                        : '',
                    flags[r.pmid]?.reason || '',
                ]),
                `https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`,
            ]),
        },
        {
            // The reproducibility facts travel WITH the data, in the same file. A spreadsheet of
            // PMIDs with no query attached is a list someone will later be unable to account for —
            // and the "AI suggested" column above is a model's opinion, so the sheet has to name
            // the model that held it.
            name: 'Search',
            head: ['Field', 'Value'],
            rows: [
                ['Database', DIALECTS[facts.db || 'pubmed'].provenance],
                ['Date searched', facts.runDate],
                // Same two numbers as the .docx methods table, and for the same reason: this sheet
                // sits next to a Records sheet holding exactly `retrieved` rows.
                ['Records identified by the query', facts.hits],
                ...(facts.retrieved !== undefined
                    ? [['Records retrieved and screened', facts.retrieved]]
                    : []),
                ...(facts.limits ? [['Limits', facts.limits]] : []),
                ...(facts.sort ? [['Ranking', facts.sort]] : []),
                ...(facts.cwid ? [['Searched by', facts.cwid]] : []),
                ...(facts.model ? [['Strategy drafted by', modelDisclosure(facts.model)]] : []),
                // The sheet must not advertise an AI verdict it does not carry — and when it IS
                // truncated it must say WHY, in the file, where Covidence opens it. A reader who never
                // saw our UI has no other way to learn that these rows are a relevance-ranked sliver.
                ...(cut
                    ? [['AI screening', 'NOT INCLUDED — this is not a screen. These records are the top '
                        + `${facts.retrieved} of ${facts.hits}, ranked by ${facts.sort || 'relevance'}. `
                        + 'Measured against published systematic reviews, a relevance-ranked top-50 '
                        + 'contained ~1% of the studies those reviews included (the typical included '
                        + 'study ranks ~300th), so an AI include/exclude verdict over this sample would '
                        + 'describe a population that is nearly disjoint from the eligible one. '
                        + 'Screen the full yield in Covidence using the Boolean query below — that is '
                        + 'the part of this search that is reliable.']]
                    : facts.model ? [['AI suggestions by', modelDisclosure(facts.model)]] : []),
                ['Boolean query', facts.query],
            ] as Array<Array<string | number>>,
        },
    ]
}
