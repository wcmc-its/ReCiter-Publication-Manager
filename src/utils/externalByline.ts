// Author lists for external (Scopus / OpenAlex / Crossref / WoS) rows on /report.
// ReCiterDB unions external pubs into analysis_summary_article / analysis_summary_author under a
// synthetic negative pmid, but never into analysis_summary_author_list, which is where /report
// reads PubMed author lists. What it does write is analysis_summary_author.authors: a PubMed-style
// byline ("Surname GA, ((Koretzky GA)), ...") per WCM person, with that person wrapped in ((..)).
// This turns those rows into the same author shape the PubMed rows use. Pure: unit-tested.

export type BylineRow = { personIdentifier?: string | null; authors?: string | null };
export type BylineAuthor = { firstName: string; lastName: string; personIdentifier?: string; rank: number };

const MARKED = /^\(\((.*)\)\)$/;

const splitByline = (byline: string) =>
  byline.split(/\s*,\s*/).filter(Boolean).map((t) => {
    const m = t.match(MARKED);
    return { name: (m ? m[1] : t).trim(), marked: !!m };
  });

// One external pub can have several WCM authors, each with their own copy of the byline marking
// only themselves. Take the longest byline as the list and attach each person to their marked name.
export const bylineAuthors = (rows: BylineRow[]): BylineAuthor[] => {
  const withText = (rows || [])
    .filter((r) => r && typeof r.authors === "string" && r.authors.trim())
    .sort((a, b) => String(a.personIdentifier || "").localeCompare(String(b.personIdentifier || "")));
  if (!withText.length) return [];
  const base = withText.reduce((a, b) => (b.authors!.length > a.authors!.length ? b : a));
  const out: BylineAuthor[] = splitByline(base.authors!).map((t, i) => ({ firstName: "", lastName: t.name, rank: i + 1 }));
  for (const r of withText) {
    if (!r.personIdentifier) continue;
    const marked = splitByline(r.authors!).find((t) => t.marked);
    if (!marked) continue;
    const slot = out.find((a) => !a.personIdentifier && a.lastName.toLowerCase() === marked.name.toLowerCase());
    if (slot) slot.personIdentifier = r.personIdentifier;
  }
  return out;
};
