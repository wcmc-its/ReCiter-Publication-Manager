export const QueryConstants = {
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
    " person  p ON asu.personIdentifier = p.personIdentifier WHERE ",

    getManageProfileForOCIDData : "SELECT a.personIdentifier, a.orcid, " + 
    "CONCAT('https://pubmed.ncbi.nlm.nih.gov/?term=', GROUP_CONCAT(DISTINCT CASE WHEN userAssertion = 'ACCEPTED' THEN b.pmid END ORDER BY b.pmid DESC SEPARATOR '+')) AS pmids_accepted, " +
    "CONCAT('https://pubmed.ncbi.nlm.nih.gov/?term=', GROUP_CONCAT(DISTINCT CASE WHEN userAssertion = 'NULL' THEN b.pmid END ORDER BY b.pmid DESC SEPARATOR '+')) AS pmids_null, " +   
    "CONCAT('https://pubmed.ncbi.nlm.nih.gov/?term=', GROUP_CONCAT(DISTINCT CASE WHEN userAssertion = 'REJECTED' THEN b.pmid END ORDER BY b.pmid DESC SEPARATOR '+')) AS pmids_rejected, " +
    "COUNT(DISTINCT CASE WHEN userAssertion = 'ACCEPTED' THEN b.pmid END) AS articleCount_accepted, " +
    "COUNT(DISTINCT CASE WHEN userAssertion = 'NULL' THEN b.pmid END) AS articleCount_null, " +   
    "COUNT(DISTINCT CASE WHEN userAssertion = 'REJECTED' THEN b.pmid END) AS articleCount_rejected, " +
    "ao2.orcid recently_selected_orcid " +
"FROM " +
    "person_article_author a " +
"JOIN " +
    "person_article b ON b.pmid = a.pmid AND b.personIdentifier = a.personIdentifier " +
"LEFT JOIN " +
    "admin_orcid ao2  on a.personIdentifier = ao2.personIdentifier AND ao2.personIdentifier = b.personIdentifier " +     
"WHERE " +
    "a.orcid IS NOT NULL " +
    "AND a.orcid != '' " +
    "AND targetAuthor = 1 " +
    "AND a.personIdentifier = :personIdentifier " +
" GROUP BY " +
    "a.personIdentifier, a.orcid " +
"HAVING " +
    "COUNT(DISTINCT CASE WHEN userAssertion = 'ACCEPTED' THEN b.pmid END) > 0 " +
"ORDER BY " +
    "articleCount_accepted DESC, " +
    "articleCount_null DESC, "   +
    "articleCount_rejected DESC " 
}   