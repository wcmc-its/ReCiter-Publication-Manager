import { useCallback } from "react";
import { useRouter } from "next/router";
import { useDispatch, useSelector } from "react-redux";
import methods from "../redux/methods/methods";
import { RootStateOrAny } from "../types/redux";
import { nextPersonAfter, personName, withPendingCount } from "../utils/nextPerson";

// Next person to curate, from the People results kept in redux (identityPaginatedData) by the
// People page. None on a direct load of /curate/<cwid>, where that list was never fetched.
export const useNextPerson = () => {
  const router = useRouter();
  const dispatch = useDispatch();
  const results = useSelector((state: RootStateOrAny) => state.identityPaginatedData);
  const current = router.pathname === "/curate/[id]" && typeof router.query.id === "string" ? router.query.id : undefined;
  const row = current ? nextPersonAfter(results?.persons, current) : null;
  const next = row ? { cwid: row.personIdentifier, name: personName(row), pending: row.countPendingArticles || 0 } : null;

  const goNext = useCallback(() => {
    if (next) router.push(`/curate/${next.cwid}`);
  }, [next?.cwid]); // eslint-disable-line react-hooks/exhaustive-deps

  // The current person has nothing left in Suggested: zero their count in the results so the
  // cycle does not come back to them.
  const markCaughtUp = useCallback(() => {
    const persons = results?.persons;
    if (!current || !Array.isArray(persons)) return;
    if (!persons.some((p: any) => p.personIdentifier === current && p.countPendingArticles)) return;
    dispatch({ type: methods.IDENTITY_CHANGE_PAGINATED_DATA, payload: { ...results, persons: withPendingCount(persons, current, 0) } });
  }, [current, results, dispatch]);

  return { next, goNext, markCaughtUp };
};
