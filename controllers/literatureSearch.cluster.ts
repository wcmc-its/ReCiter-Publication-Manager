// Mode 4 (bibliometric review) — Phase 5: keyword/topic clustering. Split out the same way
// counting/records/llm/corpus already are; the design contract lives in
// Projects/ReCiter-Publication-Manager/literature-search/PLAN-literature-mode4-bibliometric-review.md
// (not in this repo — planning docs live in Projects, code lives here).
//
// TWO PASSES, DELIBERATELY SEPARATE, the same split as strategy-build vs. suggestFixes elsewhere in
// this feature: clusterByMesh() is PURE — deterministic, no network, no LLM — and labelClusters() is
// the one Bedrock call that turns a cluster's MeSH terms into a phrase a human would actually say.
// A caller can show the clusters (by MeSH terms, by size) the instant fetchCorpus() and this
// function return, and let the label arrive a beat later without blocking the page on it.
import { PubRecord } from './literatureSearch.records'
import { UsageLog, invoke } from './literatureSearch.llm'

// ---------------------------------------------------------------------------
// PHASE 5a — MeSH-term clustering. PURE: no network, no LLM. See PHASE 5b below for the one
// Bedrock call this file makes.
//
// ponytail: a greedy top-MeSH-term partition, not graph-community-detection (Louvain/Leiden on a
// MeSH co-occurrence graph). There is no such library installed, and this codebase already prefers
// coarse-and-honest over granular-and-wrong — see flagProbableCaseSeries()'s own comment in
// literatureSearch.corpus.ts for the precedent of that exact judgment call. A record carrying
// several hot MeSH terms lands in whichever cluster's seed term is the more frequent one overall
// (a deterministic tie-break on the frequency sort, not a similarity score), so two genuinely
// distinct sub-topics that happen to share their single most-frequent MeSH term will read as one
// cluster here. Upgrade path, if a pilot corpus reads too coarse: Jaccard-similarity merging (or
// splitting) on top of these seed clusters, using the members' full MeSH sets rather than just the
// seed term.

// Generic/administrative MeSH checktags — every one a real PubMed indexing term, none of them a
// "topic" a librarian would recognise as this paper's subject. Case-insensitive match against the
// record's raw mesh[] strings.
const MESH_STOPLIST = new Set([
    'humans', 'animals', 'male', 'female', 'adult', 'aged', 'aged, 80 and over', 'middle aged',
    'child', 'child, preschool', 'infant', 'infant, newborn', 'young adult', 'adolescent',
    'rats', 'mice', 'pregnancy', 'retrospective studies', 'prospective studies',
    'follow-up studies', 'treatment outcome', 'cross-sectional studies', 'double-blind method',
    'randomized controlled trials as topic', 'reproducibility of results', 'time factors',
    // Added after the 2026-08-19 live probe: 'risk factors' seeded a 5-record cluster labeled
    // "COVID-19 transmission and infection control" whose real content was 1 tangential paper —
    // a generic checktag doing exactly the damage this stoplist exists to prevent. See
    // PROBE-RESULTS-mode4-bibliometric-review.md's "Phase 5-8 live-validation probe" section.
    'risk factors',
])

export type Cluster = { id: string; label: string; meshTerms: string[]; pmids: string[]; isUncategorized?: boolean }
export type ClusterResult = { clusters: Cluster[] }

// The record's own MeSH terms, stoplist-excluded and de-duped. A Set, not the raw array: a term
// PubMed happened to list twice on one record must not inflate that term's corpus-wide frequency,
// and this same de-duped set is reused below for both the corpus-wide count and each cluster's own
// top-terms tally, so there is exactly one place a record's "real" MeSH terms are decided.
function meshTermsOf(r: PubRecord): Set<string> {
    const out = new Set<string>()
    for (const raw of r.mesh) {
        const term = raw.trim()
        if (term && !MESH_STOPLIST.has(term.toLowerCase())) out.add(term)
    }
    return out
}

// id for a real cluster: lowercase, non-alphanumeric -> '-', collapse repeats, trim '-'.
function slugify(term: string): string {
    return term.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// Not guaranteed unique on its own — two seed MeSH terms could in principle collapse to the same
// slug ("COVID-19" / "Covid, 19") — so collisions get a numeric suffix rather than silently
// clobbering an earlier cluster's id.
function uniqueSlug(term: string, used: Set<string>): string {
    const base = slugify(term) || 'topic'
    let id = base
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`
    used.add(id)
    return id
}

// The cluster's own top few MeSH terms, by WITHIN-CLUSTER frequency (not the corpus-wide count),
// seed term first, capped at 6 — the same 6 that goes to the model in labelClusters() and to
// whatever legend or tooltip renders a cluster; it is a "what's in here" sample, not a claim that
// only 6 MeSH terms are present.
function topMeshTerms(members: PubRecord[], seedTerm: string, termsByPmid: Map<string, Set<string>>): string[] {
    const freq = new Map<string, number>()
    for (const r of members) {
        for (const term of termsByPmid.get(r.pmid)!) {
            if (term === seedTerm) continue
            freq.set(term, (freq.get(term) || 0) + 1)
        }
    }
    const rest = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t)
    return [seedTerm, ...rest].slice(0, 6)
}

export function clusterByMesh(
    records: PubRecord[],
    opts?: { minClusterSize?: number; maxClusters?: number },
): ClusterResult {
    const minClusterSize = opts?.minClusterSize ?? 5
    const maxClusters = opts?.maxClusters ?? 25

    const termsByPmid = new Map(records.map(r => [r.pmid, meshTermsOf(r)]))

    // a. Frequency across the whole corpus. Stoplist already excluded, inside meshTermsOf().
    const freq = new Map<string, number>()
    for (const terms of termsByPmid.values()) {
        for (const term of terms) freq.set(term, (freq.get(term) || 0) + 1)
    }

    // b. Seeds: frequent enough to be a real topic rather than a one-off, sorted frequency desc
    // then alphabetically for a deterministic walk order, capped at maxClusters candidates.
    const threshold = Math.max(3, Math.ceil(records.length * 0.01))
    const seeds = [...freq.entries()]
        .filter(([, n]) => n >= threshold)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([term]) => term)
        .slice(0, maxClusters)

    // c-d. Walk the seeds in that fixed order; each seed claims every still-UNASSIGNED record
    // carrying its term. A candidate cluster that comes up short of minClusterSize is never
    // published as its own cluster — its would-be members are simply never marked assigned, so a
    // later (necessarily less-frequent, by the sort above) seed can still claim them, and anything
    // no seed ever claims falls through to step e below.
    const assigned = new Set<string>()
    const usedIds = new Set<string>()
    const clusters: Cluster[] = []

    for (const seedTerm of seeds) {
        const members = records.filter(r => !assigned.has(r.pmid) && termsByPmid.get(r.pmid)!.has(seedTerm))
        if (members.length < minClusterSize) continue

        for (const r of members) assigned.add(r.pmid)
        clusters.push({
            id: uniqueSlug(seedTerm, usedIds),
            label: seedTerm,   // overwritten by labelClusters() below; the raw MeSH term is still an honest placeholder until then
            meshTerms: topMeshTerms(members, seedTerm, termsByPmid),
            pmids: members.map(r => r.pmid),
        })
    }

    // e. Everyone never claimed by a seed — including step d's fallthrough — gets one home. Never
    // silently dropped.
    const leftover = records.filter(r => !assigned.has(r.pmid))
    if (leftover.length) {
        clusters.push({
            id: 'uncategorized',
            label: 'Uncategorized / no dominant MeSH topic',
            meshTerms: [],
            pmids: leftover.map(r => r.pmid),
            isUncategorized: true,
        })
    }

    return { clusters }
}

// ---------------------------------------------------------------------------
// PHASE 5b — the one Bedrock call this file makes: turn each cluster's MeSH terms into a phrase a
// human would actually say. "Laryngoscopy, Video; Intubation, Intratracheal" is a MeSH heading
// list; "Videolaryngoscopy vs. direct laryngoscopy" is a topic label. Only a model does that
// rewrite.
//
// ONE CALL FOR ALL CLUSTERS, NOT ONE PER CLUSTER. An earlier draft of the design doc had this as a
// per-cluster call; that is the same "batch, don't loop" instinct screenRecords() already applies
// to 50 records in a single call rather than 50 separate ones — cheaper, and there is nothing about
// naming one cluster that benefits from the model being blind to the other 24 while it does it.
const CLUSTER_LABEL_TOOL = {
    name: 'submit_cluster_labels',
    description: 'Return a short, human-readable topic label for EVERY cluster supplied.',
    input_schema: {
        type: 'object' as const,
        properties: {
            labels: {
                type: 'array',
                description: 'Exactly one entry per cluster supplied. Never omit a cluster, never invent one.',
                items: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', description: 'The cluster id, exactly as supplied.' },
                        label: {
                            type: 'string',
                            description: 'A short phrase naming the shared topic, e.g. "Videolaryngoscopy vs. direct laryngoscopy". Not a MeSH term list, not the cluster id.',
                        },
                    },
                    required: ['id', 'label'],
                },
            },
        },
        required: ['labels'],
    },
}

const CLUSTER_LABEL_PROMPT = `You are naming the topic clusters found in a corpus of biomedical literature, from each cluster's own dominant MeSH descriptors and record count. You have not been shown the papers themselves — only their shared MeSH headings.

Rules:
- Return a label for EVERY cluster supplied. Never skip one, never merge two, never invent a cluster id.
- The label is a SHORT, HUMAN-READABLE PHRASE naming what the cluster is actually about — the way a clinician would describe it out loud. NOT a MeSH term list, NOT the cluster id restated.
  Good: "Videolaryngoscopy vs. direct laryngoscopy"
  Bad: "Laryngoscopy, Video; Intubation, Intratracheal" (that is just the MeSH terms restated)
  Bad: "cluster-laryngoscopy-video" (that is the id)
- Base the label only on the MeSH terms and record count given for that cluster. You have no other information about it.`

function buildClusterPrompt(clusters: Cluster[]): string {
    return clusters
        .map(c => `Cluster ${c.id} (${c.pmids.length} records) — top MeSH terms: ${c.meshTerms.join(', ')}`)
        .join('\n')
}

export async function labelClusters(clusters: Cluster[]): Promise<{ clusters: Cluster[]; usage: UsageLog }> {
    // 'uncategorized' is a fixed label, never sent to the model and never overwritten.
    const labelable = clusters.filter(c => !c.isUncategorized)
    if (!labelable.length) return { clusters, usage: { inputTokens: 0, outputTokens: 0 } }

    // invoke()'s default 2000-token ceiling, not LONG_MAX_TOKENS: this is up to maxClusters worth
    // of ONE-LINE labels, not 50 records' worth of one-clause screening reasons (SCREEN_TOOL, which
    // was measured at 4.0k+ output tokens and is why LONG_MAX_TOKENS exists at all). A phrase per
    // cluster is an order of magnitude smaller than a reason per record.
    const { input, usage } = await invoke(CLUSTER_LABEL_PROMPT, CLUSTER_LABEL_TOOL, buildClusterPrompt(labelable))

    const labels = new Map<string, string>()
    for (const l of (input?.labels || [])) {
        const id = String(l?.id ?? '').trim()
        const label = String(l?.label ?? '').trim()
        if (id && label) labels.set(id, label)
    }

    // The same lost-in-the-middle risk screenRecords() documents at length can drop a cluster's
    // label here too — but nothing here re-asks for it the way that function re-asks for a dropped
    // verdict, because the consequence is not remotely the same shape. A dropped screening verdict
    // hides a paper from the reader; a dropped cluster label costs nothing about the cluster itself
    // — its MeSH terms and every one of its PMIDs are already correct and already on the page. So a
    // cheap, honest, always-available fallback (the cluster's own top MeSH terms) is enough: it
    // never blocks the response and it never invents a name the model didn't give it.
    const missing: string[] = []
    const relabeled = clusters.map(c => {
        if (c.isUncategorized) return c
        const label = labels.get(c.id)
        if (label) return { ...c, label }
        missing.push(c.id)
        return { ...c, label: c.meshTerms.slice(0, 2).join(' / ') }
    })

    if (missing.length) {
        console.error(JSON.stringify({
            tag: 'literature-cluster-label-missing',
            ids: missing,
            why: 'the model returned no label for these clusters; falling back to their top MeSH terms',
        }))
    }

    return { clusters: relabeled, usage }
}
