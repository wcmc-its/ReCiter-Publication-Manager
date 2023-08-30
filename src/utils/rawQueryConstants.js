export const setQuery = {
	personTypeWithoutAuthors : "SELECT distinct asu.pmid,count(asu.id) over() authorsCount from analysis_summary_author asu INNER JOIN" +
	" analysis_summary_article asa ON asa.pmid = asu.pmid INNER JOIN " +
	" person_person_type  ppt ON asu.personIdentifier = ppt.personIdentifier WHERE  ",
	personTypeWithAuthors : "SELECT distinct asu.pmid,count(asu.id) over() authorsCount from analysis_summary_author asu INNER JOIN" +
	" analysis_summary_article asa ON asu.pmid = asa.pmid INNER JOIN" +
	" person_person_type  ppt ON asu.personIdentifier = ppt.personIdentifier   " +
	" INNER JOIN person p ON asu.personIdentifier = p.personIdentifier WHERE  ",
	authorsWithoutPersonType: "SELECT pmid,count(id) over() as authorsCount from (SELECT distinct asu.id,asu.pmid from analysis_summary_author asu INNER JOIN" +
	" analysis_summary_article asa ON asu.pmid = asa.pmid INNER JOIN" +
	" person  p ON asu.personIdentifier = p.personIdentifier WHERE",
    personTypeWitoutCombo :  "SELECT distinct asu.pmid,count(asu.id) over() as authorsCount from analysis_summary_article asa INNER JOIN " +
    "analysis_summary_author  asu ON asu.pmid = asa.pmid INNER JOIN" +
    " person_person_type  ppt ON asu.personIdentifier = ppt.personIdentifier WHERE ",
    personTypeWithCombo : "SELECT distinct asa.pmid, count(asu.id) over() as authorsCount from analysis_summary_article asa INNER JOIN " +
    "analysis_summary_author  asu ON asa.pmid = asu.pmid INNER JOIN" +
    " person  p ON asu.personIdentifier = p.personIdentifier INNER JOIN" +
    " person_person_type  ppt ON ppt.personIdentifier = p.personIdentifier WHERE ",
    comboWithoutPersonType : "SELECT distinct asa.pmid, count(asu.id) over() as authorsCount from analysis_summary_article asa INNER JOIN " +
    "analysis_summary_author  asu ON asa.pmid = asu.pmid INNER JOIN" +
    " person  p ON asu.personIdentifier = p.personIdentifier WHERE "
}