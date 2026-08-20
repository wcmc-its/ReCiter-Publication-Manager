// MODE 4, NARRATIVE REVIEW TAB. A DELIBERATE, NARROW DEVIATION FROM THE PLAN'S "SynthesisView.tsx —
// reused unchanged": SynthesisView's table/floor/provenance chrome is shaped for Modes 2/3's ONE
// synthesis over a human-picked ≤50 records, and forcing a multi-cluster review through Prose's
// single blank-line-paragraph splitter would have meant either concatenating every cluster into one
// wall of text with no heading between them, or hand-rolling "## heading" markdown Prose was never
// built to render. What IS reused, faithfully: Prose itself, per section — the citation-linking
// component is the actual shared contract the plan meant, not the surrounding table/floor layout.
import type { ReactNode } from 'react'
import type { NarrativeReview } from './LiteratureSearch.types'
import { Prose } from './LiteratureSearch.parts'
import s from './LiteratureSearch.module.css'

export function NarrativeReviewView({ narrative, model, expertsPanel }: {
    narrative: NarrativeReview
    model: string
    expertsPanel: ReactNode
}) {
    return (
        <>
            <div className={s.caveat}>
                <span aria-hidden="true">&#9888;</span>
                <span>
                    <b>AI-assisted narrative review{model ? `, drafted by ${model}` : ''}.</b> Each section
                    below was written over a representative shortlist of that cluster&rsquo;s papers, not a
                    full-cluster read — verify every claim against the sources. A claim with no PMID is
                    unsupported.
                </span>
            </div>

            {narrative.caseSeriesNote && (
                <div className={s.floor}>
                    <span className={s.floorLabel}>Case series</span>
                    <p className={s.floorText}>{narrative.caseSeriesNote}</p>
                </div>
            )}

            <div className={`${s.card} ${s.synthCard}`}>
                <span className={s.eyebrow}>Overview</span>
                <Prose text={narrative.intro} />
            </div>

            {narrative.sections.map(section => (
                <div className={`${s.card} ${s.synthCard}`} key={section.clusterId}>
                    <span className={s.eyebrow}>{section.label}</span>
                    {section.invented?.length ? (
                        <div className={s.invented} role="alert">
                            <span className={s.floorLabel}>Do not trust this section as written</span>
                            <p className={s.floorText}>
                                The AI cited {section.invented.length === 1 ? 'a paper' : 'papers'} not among
                                the ones selected for this cluster: PMID {section.invented.join(', ')}. Read the
                                prose below before using any of it.
                            </p>
                        </div>
                    ) : null}
                    <Prose text={section.paragraph} />
                </div>
            ))}

            {expertsPanel}
        </>
    )
}
