// The /authorships queue's sort table and its precision-lane predicate, kept out of
// authorships.controller.ts so they can be unit-tested without a database
// (tests/authorshipReviewQueues.test.mjs). Pure: sequelize builders only.
import { Op, fn, col, literal, where as sqlWhere } from "sequelize";

export const SORTS: Record<string, any[]> = {
  // default: single-candidate (high-precision) first, then identity-only score desc.
  // ["pmid","DESC"] is a secondary key so same-paper pubmed authorships land adjacent.
  // top_confidence breaks top_io_score ties in every sort that leads on it: Scopus and OpenAlex
  // rows have no IO score at all, so without it they came back in no useful order. PubMed rows
  // have one, so for them it only decides exact IO ties (ahead of pmid).
  precision: [["single_candidate", "DESC"], ["top_io_score", "DESC"], ["top_confidence", "DESC"], ["pmid", "DESC"]],
  confidence: [["top_confidence", "DESC"], ["pmid", "DESC"]],
  io: [["top_io_score", "DESC"], ["top_confidence", "DESC"], ["pmid", "DESC"]],
  fg: [["top_fg_score", "DESC"], ["pmid", "DESC"]],
  date: [["entrez_date", "DESC"], ["pmid", "DESC"]],
  date_asc: [["entrez_date", "ASC"], ["pmid", "ASC"]],
  // "Most candidates" — the biggest pile first, where "pile" is the same N the card's "Show N
  // others like this" button counts: rows sharing the byline's first|last token key (the exact
  // SUBSTRING_INDEX pair like_count's grouped COUNT in authorships.controller.ts uses). One window COUNT in the ORDER
  // BY, so no second query, no new column and no alias for the selectable endpoint to trip on.
  // Measured on dev 2026-09-15 (MariaDB 10.6, 7.7k open rows): 85 ms.
  // It replaced n_candidates, which capped at 5 on prod and dumped 35% of rows into one
  // arbitrary bucket — a sort that could not tell a 5-homonym row from a 40-homonym one.
  // ponytail: the window partitions the FILTERED set, while the card's N counts the whole open
  // queue, so the two diverge only when a chip (affiliation, date…) has cut part of a pile.
  // Under the default filters they agree; if exact parity ever matters, JOIN a derived
  // GROUP BY table on the same two tokens instead.
  candidates: [
    [literal("COUNT(*) OVER (PARTITION BY LOWER(SUBSTRING_INDEX(`AuthorshipReview`.`wcm_author`, ' ', 1)), LOWER(SUBSTRING_INDEX(`AuthorshipReview`.`wcm_author`, ' ', -1)))"), "DESC"],
    ["top_io_score", "DESC"], ["top_confidence", "DESC"], ["pmid", "DESC"],
  ],
};

// precision lane: only single-candidate (near-certain) authorships. Returns the lane's
// predicate, or null for "all" and anything unrecognised.
export function precisionWhere(precision: unknown): any {
  if (precision === "single") {
    return { single_candidate: true };
  } else if (precision === "fullname") {
    // "Unique and full given-name match": the one class curators have never once rejected.
    // Across 4,723 resolved decisions with single_candidate + top_given_match="full" there
    // are 0 rejections, in both sources and all three classifications; the same curators
    // rejected 373 of 3,251 single-candidate rows whose given name matched on INITIAL only,
    // on the same days. Rule of three puts the upper bound on this class's error at 0.064%.
    return { single_candidate: true, top_given_match: "full" };
  } else if (precision === "venuefit") {
    // "Initials + venue fit": the initial-only rows the fullname lane leaves out, where the
    // venue says what the name cannot. One candidate, the byline gives initials only (its first
    // token, periods removed, is under 3 characters) and top_venue_fit >= 1: the candidate's
    // department publishes in the venue's subfield at e (2.7x) or more of the campus-wide rate.
    // Measured on adjudicated Cornell Ithaca Scopus rows, 2026-11-16: 99.1% correct (n=1,007).
    // With a poor fit (< -1) the same picks were usually wrong. top_venue_fit is NULL on PubMed
    // rows and wherever a candidate is not an Ithaca person, so those never match.
    return {
      [Op.and]: [
        { single_candidate: true, top_given_match: "initial", top_venue_fit: { [Op.gte]: 1 } },
        sqlWhere(fn("CHAR_LENGTH", fn("REPLACE", fn("SUBSTRING_INDEX", col("wcm_author"), " ", 1), ".", "")), "<", 3),
      ],
    };
  }
  return null;
}
