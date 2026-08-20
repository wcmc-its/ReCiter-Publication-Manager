// MODE 4, OVERVIEW TAB — publications/year, evidence-type mix/year, citation-percentile trend.
// Plain CSS bars and two small inline SVG sparklines, per the plan's own "nothing here justifies a
// charting dependency" — ~10 data points a series, which a handful of divs and a polyline render
// perfectly well.
import type { CorpusStats } from './LiteratureSearch.types'
import { trendWord } from './ClusterBrowser'
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

// One decimal at most, and Number#toString drops a trailing .0 on its own (29.3, 61.3, 92) — the
// live run printed "29.299999999999997th pct", a float's full residue in front of a reader. And no
// ordinal suffix anywhere here: a median of percentiles is an average, not a rank, and "92th" is
// not a word in any case.
const round1 = (n: number) => Math.round(n * 10) / 10

export function TrendPanel({ stats }: { stats: CorpusStats }) {
    const years = stats.publicationsPerYear
    const counts = years.map(y => y.count)
    const total = counts.reduce((a, n) => a + n, 0)
    const maxCount = Math.max(1, ...counts)

    // ONE SENTENCE AND A SPARKLINE, not a bar per year — eleven near-identical bars at the top of
    // the Overview said one sentence's worth ("volume is flat") in a third of the viewport. The
    // trend word shares the first-half/second-half, 10%-dead-band rule with the cluster rows and
    // the narrative intro, and — like the narrative's trend sentence — it is computed over complete
    // years only: a partial current year annualizes to anything, and a truncated bucket must not be
    // allowed to flip the word to "declining" in August. Per-year numbers stay reachable on the
    // svg's own title/aria-label; the docx export keeps its full year table.
    const thisYear = String(new Date().getFullYear())
    const lastIsPartial = years.length > 0 && years[years.length - 1].year === thisYear
    const volumeTrend = trendWord(lastIsPartial ? counts.slice(0, -1) : counts)
    const perYearText = years.map(y => `${y.year}: ${y.count.toLocaleString()}`).join(', ')
    const volPoint = (i: number) => ({
        x: years.length === 1 ? 0 : (i / (years.length - 1)) * 100,
        y: 38 - (counts[i] / maxCount) * 36,
    })
    // The current year is a partial count and would read as a publication cliff at the right edge —
    // so its segment is drawn dashed (and named as partial in the sentence) instead of solid.
    const solidPoints = years.slice(0, lastIsPartial ? -1 : years.length)
        .map((_, i) => { const p = volPoint(i); return `${p.x},${p.y}` }).join(' ')

    const scoredYears = stats.percentileTrend.filter(p => p.median !== null)
    const maxPct = 100 // nihPercentile is always 0-100, so the sparkline's own scale never depends on the data

    return (
        <div className={s.card}>
            <span className={s.eyebrow}>Publications per year</span>
            {years.length ? (
                <>
                    <p className={s.help}>
                        {total.toLocaleString()} records, {years[0].year}&ndash;{years[years.length - 1].year}
                        {volumeTrend ? `; volume ${volumeTrend}` : ''}.
                        {lastIsPartial ? ` ${thisYear} is a partial year (dashed).` : ''}
                    </p>
                    {years.length >= 2 && (
                        <svg className={s.sparkline} viewBox="0 0 100 40" preserveAspectRatio="none" role="img"
                            aria-label={`Publications per year — ${perYearText}`}>
                            <title>{perYearText}</title>
                            <polyline
                                fill="none"
                                stroke="var(--accent)"
                                strokeWidth="2"
                                vectorEffect="non-scaling-stroke"
                                points={solidPoints}
                            />
                            {lastIsPartial && (() => {
                                const a = volPoint(years.length - 2)
                                const b = volPoint(years.length - 1)
                                return (
                                    <line
                                        x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                                        stroke="var(--accent)"
                                        strokeWidth="2"
                                        strokeDasharray="4 3"
                                        vectorEffect="non-scaling-stroke"
                                    />
                                )
                            })()}
                        </svg>
                    )}
                </>
            ) : (
                <p className={s.help}>No records to chart.</p>
            )}

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
                                {p.year}: median {round1(p.median as number)} pct ({p.scored}/{p.n} scored)
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
