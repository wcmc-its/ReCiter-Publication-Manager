// MODE 4, OVERVIEW TAB — publications/year, evidence-type mix/year, citation-percentile trend.
// Plain CSS bars and one small inline SVG sparkline, per the plan's own "nothing here justifies a
// charting dependency" — ~10 data points a series, which a handful of divs and one polyline render
// perfectly well.
import type { CorpusStats } from './LiteratureSearch.types'
import s from './LiteratureSearch.module.css'

// The same 3-bucket split assembleNarrativeReview() sums the intro's own "19% is RCT/meta-
// analysis/systematic-review..." sentence from (see HIGHER_TIER_LABELS in
// literatureSearch.narrative.ts) — reused here rather than invented afresh, so the chart and the
// sentence above it are never describing two different taxonomies of the same corpus.
const HIGHER_TIER = new Set(['RCT', 'Meta-analysis', 'Systematic review'])

function mixBuckets(yearCounts: Record<string, number>): { higher: number; obs: number; other: number; total: number } {
    let higher = 0, obs = 0, other = 0
    for (const [label, n] of Object.entries(yearCounts)) {
        if (HIGHER_TIER.has(label)) higher += n
        else if (label === 'Observational') obs += n
        else other += n
    }
    return { higher, obs, other, total: higher + obs + other }
}

export function TrendPanel({ stats }: { stats: CorpusStats }) {
    const years = stats.publicationsPerYear
    const maxCount = Math.max(1, ...years.map(y => y.count))

    const scoredYears = stats.percentileTrend.filter(p => p.median !== null)
    const maxPct = 100 // nihPercentile is always 0-100, so the sparkline's own scale never depends on the data

    return (
        <div className={s.card}>
            <span className={s.eyebrow}>Publications per year</span>
            <div className={s.trendBars}>
                {years.map(y => (
                    <div className={s.trendBarRow} key={y.year}>
                        <span className={s.trendBarYear}>{y.year}</span>
                        <span className={s.trendBarTrack}>
                            <span className={s.trendBarFill} style={{ width: `${Math.max(2, (y.count / maxCount) * 100)}%` }} />
                        </span>
                        <span className={s.trendBarCount}>{y.count.toLocaleString()}</span>
                    </div>
                ))}
                {!years.length && <p className={s.help}>No records to chart.</p>}
            </div>

            <div className={s.trendTwoCol}>
                <div>
                    <span className={s.eyebrow}>Evidence-type mix over time</span>
                    <div className={s.mixRows}>
                        {years.map(y => {
                            const mix = mixBuckets(stats.evidenceMixByYear[y.year] || {})
                            return (
                                <div className={s.mixRow} key={y.year}>
                                    <span className={s.trendBarYear}>{y.year}</span>
                                    <span className={s.mixTrack}>
                                        {mix.total > 0 ? (
                                            <>
                                                <span className={s.mixHigher} style={{ width: `${(mix.higher / mix.total) * 100}%` }} title={`${mix.higher} RCT / meta-analysis / systematic review`} />
                                                <span className={s.mixObs} style={{ width: `${(mix.obs / mix.total) * 100}%` }} title={`${mix.obs} observational`} />
                                                <span className={s.mixOther} style={{ width: `${(mix.other / mix.total) * 100}%` }} title={`${mix.other} guideline / narrative review / case report / other`} />
                                            </>
                                        ) : null}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                    <p className={s.help}>
                        <span className={s.mixLegendSwatch} data-kind="higher" /> RCT / meta-analysis / systematic review &nbsp;
                        <span className={s.mixLegendSwatch} data-kind="obs" /> Observational &nbsp;
                        <span className={s.mixLegendSwatch} data-kind="other" /> Guideline / review / case report / other
                    </p>
                </div>

                <div>
                    <span className={s.eyebrow}>Citation percentile (nihPercentile), trend</span>
                    {scoredYears.length >= 2 ? (
                        <svg className={s.sparkline} viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
                            <polyline
                                fill="none"
                                stroke="var(--accent)"
                                strokeWidth="2"
                                vectorEffect="non-scaling-stroke"
                                points={scoredYears.map((p, i) => {
                                    const x = (i / (scoredYears.length - 1)) * 100
                                    const y = 38 - ((p.median as number) / maxPct) * 36
                                    return `${x},${y}`
                                }).join(' ')}
                            />
                        </svg>
                    ) : (
                        <p className={s.help}>Not enough scored years to chart a trend.</p>
                    )}
                    <div className={s.sparkLabels}>
                        {scoredYears.map(p => (
                            <span key={p.year} className={s.sparkLabel}>
                                {p.year}: median {p.median}th pct ({p.scored}/{p.n} scored)
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
