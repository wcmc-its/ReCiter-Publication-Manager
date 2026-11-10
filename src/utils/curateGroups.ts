// Curate list grouping (Phase 2e): score bands on Suggested, publication years on Accepted and
// Rejected, plus the spot-check sample for per-band bulk actions. Pure, tested in tests/curateGroups.test.mjs.

export type GroupMode = 'flat' | 'band' | 'year'
export type Band = 'strong' | 'moderate' | 'weak'

// PM's existing tiers (70/40), the same cut-offs as the score pill on each card.
export const BANDS: { key: Band; label: string; range: string }[] = [
  { key: 'strong', label: 'Strong match', range: '70 and above' },
  { key: 'moderate', label: 'Moderate match', range: '40 to 69' },
  { key: 'weak', label: 'Weak match', range: 'below 40' },
]

// Grouping only pays off on a long list; short ones stay flat.
export const GROUP_MIN = 25

export const scoreOf = (p: any): number => Math.round(Number(p?.authorshipLikelihoodScore) || 0)
export const bandOf = (p: any): Band => { const s = scoreOf(p); return s >= 70 ? 'strong' : s >= 40 ? 'moderate' : 'weak' }
export const yearOf = (p: any): string => {
  const m = String(p?.publicationDateStandardized || p?.publicationDateDisplay || '').match(/\d{4}/)
  return m ? m[0] : 'Undated'
}

// Sort keys from sortPublications: "0"/"1" score high→low, "3" score low→high, "2"/"4" date new→old / old→new.
export const groupModeFor = (tabType: string, sort: string, n: number): GroupMode => {
  if (n <= GROUP_MIN) return 'flat'
  if (tabType === 'NULL' && (sort === '0' || sort === '1')) return 'band'
  if ((tabType === 'ACCEPTED' || tabType === 'REJECTED') && (sort === '2' || sort === '4')) return 'year'
  return 'flat'
}

export const groupKeyOf = (mode: GroupMode, p: any): string => mode === 'band' ? bandOf(p) : mode === 'year' ? yearOf(p) : ''

// Groups in list order with their counts. The list must already be sorted so groups are contiguous
// (the modes above only apply under the matching sort).
export const groupsOf = (mode: GroupMode, list: any[]): { key: string; count: number }[] => {
  if (mode === 'flat') return []
  const out: { key: string; count: number }[] = []
  for (const p of list) {
    const k = groupKeyOf(mode, p)
    if (out.length && out[out.length - 1].key === k) out[out.length - 1].count++
    else out.push({ key: k, count: 1 })
  }
  return out
}

// Year histogram: every year from first to last (gaps as zero), oldest first.
export const yearHistogram = (list: any[]): { year: number; count: number }[] => {
  const by: Record<number, number> = {}
  for (const p of list) { const y = Number(yearOf(p)); if (y) by[y] = (by[y] || 0) + 1 }
  const ys = Object.keys(by).map(Number)
  if (!ys.length) return []
  const lo = Math.min(...ys), hi = Math.max(...ys)
  return Array.from({ length: hi - lo + 1 }, (_, i) => ({ year: lo + i, count: by[lo + i] || 0 }))
}

// Spot-check: the records where a bulk action is likeliest to be wrong. Accepting a band →
// its lowest scores; rejecting → its highest.
export const spotCheckSample = (items: any[], verb: 'ACCEPTED' | 'REJECTED', n = 10): any[] =>
  [...items].sort((a, b) => verb === 'ACCEPTED' ? scoreOf(a) - scoreOf(b) : scoreOf(b) - scoreOf(a)).slice(0, n)

// Tab-strip counts: full when there's room, "1.2k" / "12k" when the strip is tight (2g).
export const fmtCount = (n: number, compact = false): string =>
  !compact || n < 1000 ? n.toLocaleString('en-US')
    : (n < 10000 ? (Math.round(n / 100) / 10).toFixed(1).replace(/\.0$/, '') : String(Math.round(n / 1000))) + 'k'
