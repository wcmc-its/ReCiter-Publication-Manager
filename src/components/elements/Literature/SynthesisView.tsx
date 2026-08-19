// MODES 2 AND 3, THE LAST SCREEN: the caveat, the fabricated-citation alarm, the evidence floor,
// the summary table and the prose — then the ways it leaves the page. Nothing here computes
// anything about the evidence; every judgment on this screen was made server-side or by the human,
// and this file only has to state them without softening any of them.
import type { ReactNode } from 'react'
import type { Synthesis } from '../../../../controllers/literatureSearch.controller'
import { modelLabel } from '../../../../controllers/literatureExport'
import { Prose } from './LiteratureSearch.parts'
import type { DbResult } from './LiteratureSearch.types'
import s from './LiteratureSearch.module.css'

export function SynthesisView({
    synthesis, result, model, isPico, included, total, provenance, copiedMarkdown, expertsPanel,
    onBack, onCopyMarkdown, onDlSynthesis, onDlPacket,
}: {
    synthesis: Synthesis
    result: DbResult | null
    model: string
    isPico: boolean
    included: number
    total: number
    provenance: { cwid: string; date: string } | null
    copiedMarkdown: boolean
    expertsPanel: ReactNode
    onBack: () => void
    onCopyMarkdown: (r: DbResult) => void
    onDlSynthesis: (r: DbResult) => void
    onDlPacket: (r: DbResult) => void
}) {
    return (
        <>
            {/* The model is NAMED, on screen and in every export. A journal asking for an AI
                declaration wants the tool and its version; "AI-assisted" alone is not one. */}
            <div className={s.caveat}>
                <span aria-hidden="true">&#9888;</span>
                <span>
                    <b>AI-assisted synthesis over the records you selected{model ? `, drafted by ${modelLabel(model)}` : ''}.</b>{' '}
                    Verify it against the sources. Every claim links to the PMID it came from &mdash; if a claim
                    carries no PMID, treat it as unsupported.
                </span>
            </div>

            {/*
              * THE EVIDENCE FLOOR. Derived server-side from PubMed's publication types —
              * no inference, no model, and therefore incapable of being wrong.
              *
              * It is here because a clinician reading a confident synthesis has no way to
              * know the whole thing rests on case series. "There is no randomized trial in
              * this set" is frequently the true answer to the question, and it is the one
              * sentence on this screen that changes what someone does next.
              */}
            {/* THE MODEL CITED A PAPER IT WAS NEVER GIVEN.
              *
              * The server has always detected this — and used to console.error it and then
              * render the fabricated PMID as a clickable PubMed link anyway, straight into a
              * .docx. A link a reader can click has to be one a reader can check. The prose
              * is deliberately NOT rewritten (silently deleting the sentence would be a
              * second fabrication over the first); it is flagged, loudly, above the thing it
              * contaminates, and the reader decides.
              */}
            {synthesis.invented?.length && (
                <div className={s.invented} role="alert">
                    <span className={s.floorLabel}>Do not trust this summary as written</span>
                    <p className={s.floorText}>
                        The AI cited {synthesis.invented.length === 1 ? 'a paper' : 'papers'} that
                        {synthesis.invented.length === 1 ? ' was' : ' were'} not among the ones you
                        selected: PMID {synthesis.invented.join(', ')}. That citation came from outside
                        this evidence set, so the sentence around it is unsupported. Read the prose
                        before you use any of it, and do not export it as it stands.
                    </p>
                </div>
            )}

            {synthesis.floor && (
                <div className={s.floor}>
                    <span className={s.floorLabel}>Strength of this evidence</span>
                    <p className={s.floorText}>{synthesis.floor}</p>
                    <p className={s.floorHelp}>
                        Study designs are PubMed&rsquo;s own indexing, not the AI&rsquo;s reading of the
                        abstracts. The table below is ordered by them &mdash; guidelines and systematic
                        reviews first, then randomized trials.
                    </p>
                </div>
            )}

            <div className={`${s.card} ${s.synthCard}`}>
                <span className={s.eyebrow}>{isPico ? 'The evidence' : 'Summary table'}</span>
                <div className={s.tblScroll}>
                    <table className={s.sum}>
                        <thead>
                            <tr>
                                <th>Study</th>
                                <th>Year</th>
                                <th>Journal</th>
                                <th>Design</th>
                                <th>Intervention</th>
                            </tr>
                        </thead>
                        <tbody>
                            {synthesis.table.map(r => (
                                <tr key={r.pmid}>
                                    <td>{r.study}</td>
                                    <td className={s.num}>{r.year}</td>
                                    <td>{r.journal}</td>
                                    <td>{r.design}</td>
                                    <td>{r.intervention}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className={`${s.card} ${s.synthCard}`}>
                <span className={s.eyebrow}>{isPico ? 'Answer' : 'Synthesis'}</span>
                <Prose text={synthesis.prose} />
            </div>

            {expertsPanel}

            <div className={s.provenance}>
                {provenance && (
                    <span>
                        <b>{included}</b> of {total} records screened in by <b>{provenance.cwid}</b>{' '}
                        on {provenance.date}.
                    </span>
                )}
                <span className={s.spacer} />
                <button className={s.btnSecondary} onClick={onBack}>
                    Back to candidates
                </button>
                {/* The answer is PROSE, so it leaves as Word — headings, the evidence table, the
                    caveat, and the query that produced it, all in one file someone can put in
                    front of a co-author. "Everything" adds the records spreadsheet beside it.
                    Copy Markdown now sits inside this guard with the rest of them, because it
                    is one of them: it carries the same facts and needs the same `result` to
                    state them. A clipboard copy with no query behind it is what we just fixed. */}
                {result && (
                    <>
                        <button
                            className={`${s.btnSecondary} ${copiedMarkdown ? s.btnSecondaryDone : ''}`}
                            onClick={() => onCopyMarkdown(result)}
                        >
                            {copiedMarkdown ? '✓ Copied' : 'Copy Markdown'}
                        </button>
                        <button className={s.btnSecondary} onClick={() => onDlSynthesis(result)}>
                            {isPico ? 'Answer' : 'Synthesis'} (.docx)
                        </button>
                        <button className={s.btn} onClick={() => onDlPacket(result)}>
                            Download everything
                        </button>
                    </>
                )}
            </div>
        </>
    )
}
