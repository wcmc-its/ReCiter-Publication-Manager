// Curate filter: a pasted list of PMIDs, DOIs, doi.org URLs or PubMed URLs (space-, comma- or
// newline-separated). Returns null unless EVERY token is an id, so ordinary text search still works.

export const normalizeDoi = (s: string): string =>
  s.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').replace(/^doi:\s*/i, '').replace(/[.,;]+$/, '').toLowerCase()

export const parseIdList = (search: string): { pmids: Set<number>; dois: Set<string> } | null => {
  const tokens = String(search || '').split(/[\s,;]+/).filter(Boolean)
  if (!tokens.length) return null
  const pmids = new Set<number>(), dois = new Set<string>()
  for (const t of tokens) {
    const pm = t.match(/^(?:https?:\/\/(?:www\.)?(?:pubmed\.ncbi\.nlm\.nih\.gov|ncbi\.nlm\.nih\.gov\/pubmed)\/)?(\d{1,9})\/?$/i)
    if (pm) { pmids.add(Number(pm[1])); continue }
    const doi = normalizeDoi(t)
    if (/^10\.\d{4,9}\/\S+$/.test(doi)) { dois.add(doi); continue }
    return null
  }
  return { pmids, dois }
}

export const matchesIdList = (pub: any, ids: { pmids: Set<number>; dois: Set<string> }): boolean =>
  ids.pmids.has(Number(pub?.pmid)) || (!!pub?.doi && ids.dois.has(normalizeDoi(pub.doi)))
