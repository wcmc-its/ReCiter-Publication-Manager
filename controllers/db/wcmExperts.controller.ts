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

import sequelize from '../../src/db/db'
import { QueryTypes } from 'sequelize'

export type WcmExpert = {
    personIdentifier: string
    firstName: string
    lastName: string
    primaryOrganizationalUnit: string | null
    pubs: number
}

export type WcmExpertResult = {
    experts: WcmExpert[]
    total: number   // how many faculty matched in full; experts[] is only the top slice
}

export async function findWcmExperts(meshTerms: string[], limit = 5): Promise<WcmExpertResult> {
    const terms = (meshTerms || []).map(t => String(t).trim()).filter(Boolean)
    if (terms.length === 0) return { experts: [], total: 0 }

    // Only ACCEPTED assertions count — a suggested-but-unconfirmed article is not evidence
    // that this person works on the topic.
    const experts: WcmExpert[] = await sequelize.query(
        `SELECT p.personIdentifier, p.firstName, p.lastName,
                p.primaryOrganizationalUnit,
                COUNT(DISTINCT k.pmid) AS pubs
         FROM person_article_keyword k
         JOIN person_article pa ON pa.personIdentifier = k.personIdentifier
                               AND pa.pmid = k.pmid
                               AND pa.userAssertion = 'ACCEPTED'
         JOIN person p ON p.personIdentifier = k.personIdentifier
         WHERE k.keyword IN (:terms)
         GROUP BY p.personIdentifier, p.firstName, p.lastName, p.primaryOrganizationalUnit
         ORDER BY pubs DESC
         LIMIT :limit`,
        { replacements: { terms, limit }, type: QueryTypes.SELECT },
    ) as WcmExpert[]

    const totalRow: any[] = await sequelize.query(
        `SELECT COUNT(*) AS total FROM (
             SELECT k.personIdentifier
             FROM person_article_keyword k
             JOIN person_article pa ON pa.personIdentifier = k.personIdentifier
                                   AND pa.pmid = k.pmid
                                   AND pa.userAssertion = 'ACCEPTED'
             WHERE k.keyword IN (:terms)
             GROUP BY k.personIdentifier
         ) t`,
        { replacements: { terms }, type: QueryTypes.SELECT },
    )

    return { experts, total: Number(totalRow?.[0]?.total ?? 0) }
}
