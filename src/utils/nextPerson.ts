// "Next person" for Curate (the section-nav pill and the Suggested empty state). Pure, tested in
// tests/nextPerson.test.mjs.

export type PersonRow = {
  personIdentifier: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  countPendingArticles?: number;
};

// The first person after `current` in the People results order (wrapping around, never `current`)
// with pending suggestions; null when there is none or no results list.
export const nextPersonAfter = (persons: PersonRow[] | undefined | null, current: string | undefined): PersonRow | null => {
  if (!Array.isArray(persons) || persons.length === 0) return null;
  const ci = persons.findIndex((p) => p?.personIdentifier === current);
  const order = [...persons.slice(ci + 1), ...persons.slice(0, Math.max(ci, 0))];
  return order.find((p) => p && p.personIdentifier !== current && (p.countPendingArticles || 0) > 0) || null;
};

export const personName = (p: PersonRow): string =>
  [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ') || p.personIdentifier;

// The results list with `cwid`'s pending count set, so a person just finished drops out of the
// cycle without refetching People.
export const withPendingCount = <T extends PersonRow>(persons: T[], cwid: string, count: number): T[] =>
  persons.map((p) => (p.personIdentifier === cwid ? { ...p, countPendingArticles: count } : p));
