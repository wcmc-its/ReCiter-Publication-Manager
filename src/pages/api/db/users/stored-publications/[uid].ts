import type { NextApiRequest, NextApiResponse } from 'next'
import { reciterConfig } from '../../../../../../config/local'
import { storedAssertions } from '../../../../../lib/cornellReciter'
import { findPubmedByPmids } from '../../../../../../controllers/pubmedLookup.controller'
import { formatPubmedSearch } from '../../../../../../controllers/pubmed.controller'
import { toReciterArticle } from '../../../../../utils/toReciterArticle'

// GET /api/db/users/stored-publications/<uid> -> the feature-generator response shape
// ({ reciter: { personIdentifier, reCiterArticleFeatures }, reciterPending: [] }), built from the
// stores instead of a ReCiter run. For the /curate page of a Cornell-only person who isn't
// ReCiter-eligible yet (src/utils/cornellOnly.ts): their Accepted and Rejected PubMed tabs are
// GoldStandard knownpmids / rejectedpmids. Each article is the same formatted PubMed record the
// Add tab's results and its direct accept use (formatPubmedSearch -> toReciterArticle), so the
// tab content renders and Undo / Reject work exactly as for a manually added article. External
// works are not here: the All sources tab reads ExternalArticle itself, as it does for everyone.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.status(400).send('HTTP Method supported is GET')
        return
    }
    if (req.headers.authorization === undefined) {
        res.status(400).send('Authorization header is needed')
        return
    }
    if (req.headers.authorization !== reciterConfig.backendApiKey) {
        res.status(401).send('Authorization header is incorrect')
        return
    }
    const uid = String(req.query.uid || '')
    try {
        const assertions = await storedAssertions(uid)
        const raw = await findPubmedByPmids(assertions.map((a) => a.pmid))
        const formatted = new Map<number, any>()
        formatPubmedSearch({ filter100PubMedArticles: [...raw.values()] }, false)
            .forEach((p: any) => { if (p.pmid) formatted.set(Number(p.pmid), p) })
        const reCiterArticleFeatures = assertions.map(({ pmid, userAssertion }) => ({
            // A PMID PubMed didn't return still gets a row, so it can be seen and undone.
            ...toReciterArticle(formatted.get(pmid) || { pmid, title: `PMID ${pmid}`, authors: [], journal: '', displayDate: '' }, userAssertion),
            pmid,
        }))
        res.status(200).send({
            statusCode: 200,
            reciter: { personIdentifier: uid, reCiterArticleFeatures },
            reciterPending: [],
        })
    } catch (e) {
        console.log(`stored-publications/${uid} failed:`, e)
        res.status(502).send({ statusCode: 502, message: 'Could not read the stored publications' })
    }
}
