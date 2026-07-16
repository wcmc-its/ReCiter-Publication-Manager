// PM#771 — check whether a DOI is present in PubMed. External records are unscored,
// so before adding an external (OpenAlex) work we confirm it is genuinely NOT in
// PubMed; if it is, the curator is steered to the PubMed accept path so the article
// becomes scored evidence. OpenAlex's own PMID field is incomplete (~21% of
// PubMed-indexed works lack it), so we ask PubMed directly by DOI.
//
// Routed through the ReCiter PubMed Retrieval Tool (query-complex) rather than a raw
// eutils call: the tool holds PUBMED_API_KEY and the retry/backoff, so this DOI check
// no longer risks unkeyed 429s from PM's server. The matching term is still `<doi>[AID]`
// (Article Identifier), identical to the previous direct query.

import { reciterConfig } from '../config/local'

// Returns the PMID if the DOI resolves to a PubMed record, else null.
export async function findPubmedByDoi(doi: string): Promise<number | null> {
    if (!doi) return null
    // strategy-query is concatenated raw into the PubMed term by the tool's PubMedQuery,
    // so the [AID] tag survives the POST body unchanged.
    const res = await fetch(reciterConfig.reciterPubmed.searchPubmedEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'reciter-pub-manager-server',
        },
        body: JSON.stringify({ 'strategy-query': `${doi}[AID]` }),
    })
    if (!res.ok) throw new Error(`pubmed retrieval tool HTTP ${res.status}`)
    const data: any = await res.json()
    // query-complex returns an array of PubMedArticle; PMID lives at
    // medlinecitation.medlinecitationpmid.pmid.
    const pmid = data?.[0]?.medlinecitation?.medlinecitationpmid?.pmid
    return pmid ? Number(pmid) : null
}
