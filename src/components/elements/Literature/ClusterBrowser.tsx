// MODE 4 — the cluster list: Overview's top few, and the Clusters tab's full roster. One row per
// real cluster (never the uncategorized bucket — see clusterByMesh()'s own comment on why that
// bucket exists and isFiltered out of every place a cluster is a NAMED topic), sorted by size, with
// a plain-language trend word computed from the cluster's own year counts.
//
// ponytail: size is the only sort. The mockup shows a "sort:" dropdown; nothing else on this page
// has a second sort key wired up yet (no relevance/recency toggle), and size-descending is what the
// plan's own mockup uses by default. Add a real sort control when a pilot user asks for one.
import type { Cluster } from './LiteratureSearch.types'
import type { M4Record } from './LiteratureSearch.types'
import s from './LiteratureSearch.module.css'

// Same "first half vs second half, 10% dead band" trend rule assembleNarrativeReview()'s own
// trendNote() applies to the whole corpus — reused here per cluster rather than reinvented, so a
// cluster row's "rising"/"declining" means the same thing the intro paragraph's own trend
// sentence does.
function trendWord(counts: number[]): string {
    if (counts.length < 2) return ''
    const mid = Math.floor(counts.length / 2)
    const mean = (xs: number[]) => xs.reduce((a, n) => a + n, 0) / xs.length
    const first = mean(counts.slice(0, mid))
    const second = mean(counts.slice(mid))
    if (first === 0 && second === 0) return ''
    const ratio = first === 0 ? Infinity : second / first
    return ratio > 1.1 ? 'rising' : ratio < 0.9 ? 'declining' : 'flat'
}

function yearCountsFor(pmids: Set<string>, corpus: M4Record[]): number[] {
    const byYear = new Map<string, number>()
    for (const r of corpus) {
        if (!pmids.has(r.pmid)) continue
        byYear.set(r.year, (byYear.get(r.year) || 0) + 1)
    }
    return [...byYear.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, n]) => n)
}

function ClusterRow({ cluster, corpus }: { cluster: Cluster; corpus: M4Record[] }) {
    const pmidSet = new Set(cluster.pmids)
    const trend = trendWord(yearCountsFor(pmidSet, corpus))
    // Representative papers: impact and relevance summed, top 3, shown as a quick "what's in here"
    // sample — not a claim about which papers the narrative actually cited (see the cluster's own
    // narrative section for that, in citedPmids).
    //
    // impactScore is a 0-100 integer and relevanceScore is a 0-1 float, so the impact term is
    // divided by 100 before they are added. Summing them raw would make relevance a rounding error
    // against a number a hundred times its size, and the "representative" papers would silently
    // become "the three most impactful papers, on-topic or not" — which is exactly the failure the
    // rest of this review is about.
    const top = corpus
        .filter(r => pmidSet.has(r.pmid))
        .map(r => ({ r, rank: (r.impactScore || 0) / 100 + (r.relevanceScore || 0) }))
        .sort((a, b) => b.rank - a.rank)
        .slice(0, 3)
        .map(x => x.r)

    return (
        <div className={s.clusterRow}>
            <div className={s.clusterHead}>
                <span className={s.clusterLabel}>{cluster.label}</span>
                <span className={s.clusterSize}>{cluster.pmids.length.toLocaleString()} papers</span>
                {trend && <span className={s.clusterTrend} data-trend={trend}>{trend}</span>}
            </div>
            {cluster.meshTerms.length > 0 && (
                <div className={s.clusterMesh}>{cluster.meshTerms.join(' · ')}</div>
            )}
            {top.length > 0 && (
                <ul className={s.clusterReps}>
                    {top.map(r => (
                        <li key={r.pmid}>
                            <a href={`https://pubmed.ncbi.nlm.nih.gov/${r.pmid}/`} target="_blank" rel="noopener noreferrer">
                                {r.authors} ({r.year})
                            </a> — {r.title}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

export function ClusterBrowser({ clusters, corpus, limit, onViewAll }: {
    clusters: Cluster[]
    corpus: M4Record[]
    limit?: number
    onViewAll?: () => void
}) {
    const real = clusters.filter(c => !c.isUncategorized).sort((a, b) => b.pmids.length - a.pmids.length)
    const uncategorized = clusters.find(c => c.isUncategorized)
    const shown = limit ? real.slice(0, limit) : real

    return (
        <div className={s.card}>
            <div className={s.clusterBrowserHead}>
                <span className={s.eyebrow}>Keyword clusters ({real.length})</span>
                {limit && real.length > limit && onViewAll && (
                    <button className={s.btnSecondary} onClick={onViewAll}>View all clusters</button>
                )}
            </div>
            <div>
                {shown.map(c => <ClusterRow key={c.id} cluster={c} corpus={corpus} />)}
            </div>
            {uncategorized && !limit && (
                <p className={s.help}>
                    <b>{uncategorized.pmids.length.toLocaleString()} records</b> carried no MeSH term frequent
                    enough to seed their own cluster (the 1%-of-corpus threshold — see clusterByMesh() in
                    literatureSearch.cluster.ts) and are not represented above. Every one of them is still
                    counted in the trend and evidence-mix charts and in the corpus table.
                </p>
            )}
        </div>
    )
}
