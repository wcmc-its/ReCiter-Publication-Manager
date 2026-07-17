// Data access for the "experts at Weill Cornell" panel — the raw queries against
// person_article_keyword. Kept apart from the controller so the SQL lives in one place; the domain
// notes (the free MeSH join key, the load-bearing LIMIT, the blank-department case) are in
// wcmExperts.controller.ts.
import sequelize from '../../src/db/db'
import { QueryTypes } from 'sequelize'

export type WcmExpert = {
    personIdentifier: string
    firstName: string
    lastName: string
    primaryOrganizationalUnit: string | null
    pubs: number
}

// The top slice, ranked by publication count. Only ACCEPTED assertions count — a
// suggested-but-unconfirmed article is not evidence that this person works on the topic.
export function queryTopExperts(terms: string[], limit: number): Promise<WcmExpert[]> {
    return sequelize.query(
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
    ) as Promise<WcmExpert[]>
}

// How many faculty matched in full — the slice above is only the top `limit`, and the caller MUST
// show the honest total ("top 5 of 430") rather than implying the list is exhaustive.
export async function queryExpertTotal(terms: string[]): Promise<number> {
    const rows: any[] = await sequelize.query(
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
    return Number(rows?.[0]?.total ?? 0)
}
