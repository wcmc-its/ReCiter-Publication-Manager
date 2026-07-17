// "At Weill Cornell" — the faculty who publish on the MeSH terms the strategy targets.
// This panel is the reason the feature lives in RPM rather than being a bookmark to
// claude.ai, and it is this table's first consumer.
//
// The join key is free: Claude writes the strategy in MeSH, and person_article_keyword
// is keyed on MeSH major descriptors. No synonym table, no embeddings, no second search
// problem. It also works in Mode 1 with no records retrieved, straight off the query's
// own MeSH terms.
//
// Verified live against dev reciterdb 2026-07-12:
//   - person_article_keyword holds 2,310,368 rows.
//   - The join for ('Gastrointestinal Microbiome','Probiotics') returns 430 faculty with
//     >=1 ACCEPTED publication — NOT the handful an earlier wireframe implied. So the
//     LIMIT is load-bearing, not cosmetic, and the caller MUST show the honest total
//     ("top 5 of 430") rather than implying the list is exhaustive.
//   - primaryOrganizationalUnit is genuinely blank for MSK-side appointments (Pamer,
//     Van den Brink, Xavier). Render that as "department not recorded", never an empty cell.

import { WcmExpert, queryTopExperts, queryExpertTotal } from './wcmExperts.repository'

export type { WcmExpert }

export type WcmExpertResult = {
    experts: WcmExpert[]
    total: number   // how many faculty matched in full; experts[] is only the top slice
}

export async function findWcmExperts(meshTerms: string[], limit = 5): Promise<WcmExpertResult> {
    const terms = (meshTerms || []).map(t => String(t).trim()).filter(Boolean)
    if (terms.length === 0) return { experts: [], total: 0 }

    const experts = await queryTopExperts(terms, limit)
    const total = await queryExpertTotal(terms)
    return { experts, total }
}
