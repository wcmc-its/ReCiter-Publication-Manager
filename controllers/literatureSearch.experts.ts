// The "At Weill Cornell" expert-panel bridge: turn a strategy's concept blocks into the MeSH
// descriptors that join against person_article_keyword. Split out of the API route so the route
// handles request/response and this domain logic lives in the service layer. The findWcmExperts
// call and its per-branch error policy stay at the call sites — they differ (a re-count lets it
// throw; a build swallows it), so that policy is the route's, not this helper's.
import { Rendering } from './literatureSearch.strategy'

// The MeSH descriptors the strategy targets, for the "At Weill Cornell" panel. Pulled
// straight out of the concept blocks the model wrote — the join key is free because
// person_article_keyword is itself keyed on MeSH.
//
// Both quoted and UNQUOTED descriptors are valid PubMed, and the model emits both --
// "Gastrointestinal Microbiome"[MeSH] and Probiotics[MeSH]. An earlier regex here required
// the quotes, so a strategy written in the unquoted style extracted zero MeSH terms and the
// panel silently rendered empty while the strategy itself looked perfect. Split on OR and
// take the descriptor off each [MeSH]-tagged token instead; [tiab] free-text terms are
// skipped because the join key is MeSH.
// NOT EVERY MeSH DESCRIPTOR IS A TOPIC. "Humans"[MeSH] is a FILTER — Mode 2 emits it as its own
// AND-ed block (see hoistFilters), and every clinical paper ever indexed carries it. Harvest it as
// a topic and the "At Weill Cornell" panel stops answering "who here works on probiotics?" and
// starts answering "who here publishes on humans?" — which is everyone, ranked by output. The
// panel would still render, still look plausible, and be worthless. Caught in a live run:
//   WHERE k.keyword IN ('Probiotics', 'Lactobacillus', 'Bifidobacterium', 'Humans')
//
// Same for Animals, Male, Female, Adult, Aged, Adolescent, Child — the MEDLINE "check tags", which
// are applied to nearly every record by definition and are therefore never what the panel means.
const NOT_A_TOPIC = new Set([
    'humans', 'human', 'animals', 'male', 'female',
    'adult', 'adolescent', 'aged', 'child', 'infant', 'middle aged', 'young adult',
])

// AN UNTICKED LINE WAS NEVER SEARCHED, and that rule does not stop at the export.
//
// This used to read every line, ticked or not, so the panel's caption -- "faculty publishing on these
// MeSH terms" -- counted faculty against terms the librarian had switched OFF and the search had
// never used. Untick the whole Probiotics MeSH line and the strategy stops being about probiotics
// while the panel goes on ranking probiotics researchers, with a confident total beside them.
export function meshFromConcepts(concepts: Rendering[]): string[] {
    const found = new Set<string>()
    for (const c of concepts) {
        for (const line of c.lines.filter(l => l.on)) {
            for (const token of line.terms.split(/\s+OR\s+/i)) {
                const m = token.match(/^\s*\(?\s*"?([^"[\]]+?)"?\s*\[(?:MeSH|majr)/i)
                if (m && !NOT_A_TOPIC.has(m[1].trim().toLowerCase())) found.add(m[1].trim())
            }
        }
    }
    return Array.from(found)
}
