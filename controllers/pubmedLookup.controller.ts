// PM#771 — check whether a DOI is present in PubMed. External records are unscored,
// so before adding an external (OpenAlex) work we confirm it is genuinely NOT in
// PubMed; if it is, the curator is steered to the PubMed accept path so the article
// becomes scored evidence. OpenAlex's own PMID field is incomplete (~21% of
// PubMed-indexed works lack it), so we ask PubMed directly by DOI.
// ponytail: keyless eutils, fine at per-click volume; add an NCBI key if rate-limited.

const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi'

// Returns the PMID if the DOI resolves to a PubMed record, else null.
export async function findPubmedByDoi(doi: string): Promise<number | null> {
    if (!doi) return null
    const term = encodeURIComponent(`${doi}[AID]`)
    const url = `${EUTILS}?db=pubmed&retmode=json&term=${term}`
    const res = await fetch(url, { headers: { 'User-Agent': 'reciter-pub-manager-server' } })
    if (!res.ok) throw new Error(`eutils HTTP ${res.status}`)
    const data: any = await res.json()
    const idlist = (data && data.esearchresult && data.esearchresult.idlist) || []
    return idlist.length ? Number(idlist[0]) : null
}
