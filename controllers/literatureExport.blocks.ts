// Block model + the reproducibility header that every export opens with, plus the model-label
// helpers. Shared foundation for the three document builders. Split out of literatureExport.ts,
// which is now the re-export barrel and carries the "an export that cannot be re-run is not
// evidence" contract in its header comment.
import { numberStrategy, DIALECTS, Rendering, Db, SeedKind } from './literatureSearch.strategy'

export type Block =
    | { kind: 'h1'; text: string }
    | { kind: 'h2'; text: string }
    | { kind: 'p'; text: string }
    | { kind: 'small'; text: string }
    | { kind: 'mono'; text: string }                                  // the query — must be copy-pastable
    | { kind: 'table'; head: string[]; rows: string[][] }
    | { kind: 'spacer' }

// ---------------------------------------------------------------------------
// WHICH MODEL WROTE THIS.
//
// Journals increasingly require an AI declaration to name the tool AND ITS VERSION. "AI-assisted",
// with no model named, is not a declaration. So every document carries both halves:
//
//   the PRETTY name — what a reader understands.
//   the PROFILE ID  — what makes the run reproducible. The id, not the name, pins the weights, and
//                     the id is what the pod logs and the Bedrock bill agree on. Never drop it for
//                     being ugly.
//
// It is not a secret: BEDROCK_MODEL_ID is already on every log line this feature emits.
//
// ponytail: derived from the id, not a lookup table. A table of model names goes stale the day AWS
// ships the next one, and a stale pretty name sitting next to a correct id is worse than no pretty
// name at all. Ceiling: it reads the `family-version` id shape (claude-opus-4-8); an id it cannot
// parse falls through to the raw id — which is the half that had to be right anyway.
//
// THE TRAP THIS REGEX IS SHAPED AROUND: a real profile id does not stop at the version. It carries a
// release date and a revision — us.anthropic.claude-opus-4-5-20251101-v1:0 — and a version pattern
// that is merely "digits and hyphens" swallows both, inventing "Claude Opus 4.5.20251101." out of
// thin air. A fabricated version in a journal's AI declaration is the one error nobody catches,
// because it looks exactly like a real one. So the version is 1–2 digit groups (a version is 4-8; a
// date is 20251101 and can never be mistaken for one) and it must END at a boundary we actually
// recognize: end-of-id, a -YYYYMMDD date, a -vN revision, or a :N. An id whose suffix we do NOT
// recognize does not get a guessed name — it falls through raw. A missing model name beats a wrong one.
export function modelLabel(id: string): string {
    const m = String(id || '').match(
        /^(?:[a-z]+\.)?anthropic\.claude-([a-z]+)-(\d{1,2}(?:-\d{1,2})*)(?=$|-\d{8}\b|-v\d|:)/i,
    )
    if (!m) return String(id || '')
    return `Claude ${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[2].replace(/-/g, '.')}, via AWS Bedrock`
}

export const modelDisclosure = (id: string) => `${modelLabel(id)} (${id})`

// ---------------------------------------------------------------------------
// The facts. Every document opens with these, and this is the only place they are assembled.

export type RunFacts = {
    // WHICH DATABASE. Not decoration: the document says "paste this into X to reproduce the count",
    // and a Scopus strategy pasted into PubMed reproduces nothing. Defaults to PubMed for the two
    // modes that only have one.
    db?: Db
    query: string
    // NULL = this database has no count because we have no API for it (Embase via Ovid). Never zero.
    hits: number | null
    // HOW MANY RECORDS WERE ACTUALLY PULLED DOWN. Modes 2 and 3 retrieve a CAPPED, ranked slice — 50
    // of however many the query yields — so `hits` and "retrieved" are two different numbers there,
    // and only Mode 1 (which counts and never retrieves) may conflate them. Left undefined by Mode 1.
    retrieved?: number
    runDate: string
    cwid?: string
    limits?: string
    sort?: string
    model?: string             // the Bedrock profile id, verbatim
    unsupportedLimits?: string[]
}

export function reproHeader(f: RunFacts): Block[] {
    const dialect = DIALECTS[f.db || 'pubmed']
    return [
        { kind: 'h2', text: 'How to reproduce this search' },
        { kind: 'table', head: ['Field', 'Value'], rows: [
            ['Database', dialect.provenance],
            ['Date searched', f.runDate],
            // TWO NUMBERS, NEVER ONE. In Modes 2/3 the query yields thousands and we retrieve the top
            // 50 — so a single "Records retrieved: 1391" row is how a co-author writes "Records
            // screened: 1,391" into a PRISMA flow diagram when the true figure is 50, twenty-seven
            // times smaller. The cap and the ranking were declared on screen and in NO export. They
            // are now in the methods, where the reader building the flow diagram actually looks.
            // AN UNCOUNTED DATABASE STATES THAT IT IS UNCOUNTED. `hits` is null for Embase (Ovid) —
            // no API — and `String(null)` is the word "null", while `Number(null)` is 0. Both are
            // fabrications in a methods table. The strategy is real and was drafted; it was never RUN,
            // and the document has to be the thing that says so, because the reader was not in the
            // room. THIS IS THE PRISMA-S APPENDIX: a yield printed here is a yield someone will cite.
            ...(f.hits === null
                ? [['Records identified by the query', `Not counted — we have no API for ${dialect.name}. This strategy was DRAFTED, not executed: run it in Ovid to obtain the yield.`]]
                : [['Records identified by the query', String(f.hits)]]),
            ...(f.hits !== null && f.retrieved !== undefined && f.retrieved < f.hits
                ? [['Records retrieved and screened', `${f.retrieved} — the top ${f.retrieved} of ${f.hits}, ranked by ${f.sort || 'relevance'}. The rest were not retrieved.`]]
                : f.hits !== null && f.retrieved !== undefined
                    ? [['Records retrieved and screened', String(f.retrieved)]]
                    : []),
            ...(f.limits ? [['Limits', f.limits]] : []),
            // A LIMIT THIS DATABASE COULD NOT EXPRESS. It goes in the METHODS, not just on the
            // screen, because the count above answers a BROADER question than the librarian asked —
            // and a reader comparing it with the PubMed count has no way to know that unless the
            // document says so. Scopus has no RCT document type, so "RCT only" lands here.
            //
            // Ovid is a DIFFERENT case and gets a different sentence: Ovid can express these limits
            // perfectly well — just in its own Limits panel, against a numbered set, rather than as
            // terms inside the Boolean. Telling a librarian "Ovid cannot express this" would be false,
            // and would send them looking for a workaround to a problem that does not exist.
            ...(f.unsupportedLimits?.length
                ? [['Limits NOT applied', dialect.countable
                    ? `${f.unsupportedLimits.join('; ')} — ${dialect.name} cannot express this limit, so the count above is not restricted by it`
                    : `${f.unsupportedLimits.join('; ')} — apply these in Ovid's own Limits panel after running the strategy. They are not part of the query text above.`]]
                : []),
            ...(f.sort ? [['Ranking', f.sort]] : []),
            ...(f.cwid ? [['Searched by', f.cwid]] : []),
            // THE DISCLOSURE PEOPLE FORGET. The QUERY is model-drafted too, not just the prose — so
            // it belongs in the STRATEGY export, not only in the synthesis. A PRISMA-S appendix that
            // does not say the strategy was AI-drafted and human-reviewed is incomplete, and this
            // header is the only thing in a strategy export that could ever say it.
            ...(f.model
                ? [['Strategy drafted by', `${modelDisclosure(f.model)}, then reviewed and edited by the person named above`]]
                : []),
        ] },
        { kind: 'p', text: `Full Boolean query — paste this into ${dialect.name} to reproduce the count above:` },
        { kind: 'mono', text: f.query },
    ]
}
