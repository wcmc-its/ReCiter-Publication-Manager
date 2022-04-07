import type { NextApiRequest, NextApiResponse } from "next";
import sequelize from "../../../src/db/db";
import { PublicationSearchFilter } from "../../../types/publication.report.search";

export const publicationSearchWithFilter = async (
  req: NextApiRequest,
  res: NextApiResponse
) => {
  try {
    let apiBody: PublicationSearchFilter = req.body;
    let selectRawQuery = "";
    if (apiBody && apiBody.filters) {
      selectRawQuery =
        "SELECT distinct(a1.pmid), a1.articleTitle, a1.journalTitleVerbose,a1.publicationDateDisplay, " +
        "a1.publicationTypeCanonical, a1.doi, a1.percentileNIH, a1.relativeCitationRatioNIH, " +
        "a1.journalImpactScore1, a1.trendingPubsScore " +
        "from analysis_summary_author a join analysis_summary_article a1 on a1.pmid = a.pmid " +
        "join person p on p.personIdentifier = a.personIdentifier " +
        "join personPersonType p1 on p1.personIdentifier = p.personIdentifier " +
        "where ";
        //Add personIdentifier filter if exists
        if(apiBody.filters.personIdentifers && apiBody.filters.personIdentifers.length > 0) 
            selectRawQuery = selectRawQuery + "a.personIdentifier in (" +  apiBody.filters.personIdentifers.map(i => `"${i}"`).join(",") + ") and "
        //Add primaryOrganizationfilter if exists
        if(apiBody.filters.orgUnits && apiBody.filters.orgUnits.length > 0) 
            selectRawQuery = selectRawQuery + "p.primaryOrganizationalUnit in (" +  apiBody.filters.orgUnits.map(i => `"${i}"`).join(",") + ") and "
        //Add primaryInstitution if exists
        if(apiBody.filters.institutions && apiBody.filters.institutions.length > 0) 
            selectRawQuery = selectRawQuery + "p.primaryInstitution in (" +  apiBody.filters.institutions.map(i => `"${i}"`).join(",") + ") and "
        //Add personTypes if exists
        if(apiBody.filters.personTypes && apiBody.filters.personTypes.length > 0) 
            selectRawQuery = selectRawQuery + "p1.personType in (" +  apiBody.filters.personTypes.map(i => `"${i}"`).join(",") + ") and "
        //Add authorPosition if exists
        if(apiBody.filters.authorPosition && apiBody.filters.authorPosition.length > 0) 
            selectRawQuery = selectRawQuery + "a.authorPosition in (" +  apiBody.filters.authorPosition.map(i => `"${i}"`).join(",") + ") and "
        
        //article-level qualifiers
        //Date range if exists
        if(apiBody.filters.datePublicationAddedToEntrezLowerBound && apiBody.filters.datePublicationAddedToEntrezUpperBound) 
            selectRawQuery = selectRawQuery + "a1.datePublicationAddedToEntrez > \"" + apiBody.filters.datePublicationAddedToEntrezLowerBound + "\" and a1.datePublicationAddedToEntrez < \"" + apiBody.filters.datePublicationAddedToEntrezUpperBound + "\" and "
        
        //PublicationType if exists
        if(apiBody.filters.publicationTypeCanonical && apiBody.filters.publicationTypeCanonical.length > 0) 
            selectRawQuery = selectRawQuery + "a1.publicationTypeCanonical in (" +  apiBody.filters.publicationTypeCanonical.map(i => `"${i}"`).join(",") + ") and "

        //JournalTitleVerbose if exists
        if(apiBody.filters.journalTitleVerbose && apiBody.filters.journalTitleVerbose.length > 0) 
            selectRawQuery = selectRawQuery + "a1.journalTitleVerbose in (" +  apiBody.filters.journalTitleVerbose.map(i => `"${i}"`).join(",") + ") and "

        //journalImpactScore if exists
        if(apiBody.filters.journalImpactScoreLowerBound && apiBody.filters.journalImpactScoreUpperBound) 
            selectRawQuery = selectRawQuery + "a1.journalImpactScore1 > " + apiBody.filters.journalImpactScoreLowerBound + " and a1.journalImpactScore1 < " + apiBody.filters.journalImpactScoreUpperBound + " and "

        selectRawQuery = selectRawQuery.trimEnd();
        if(selectRawQuery.endsWith("and"))
            selectRawQuery = selectRawQuery.substring(0, selectRawQuery.length - 3)
        
            console.log(selectRawQuery)
    }
    const searchOutput: any = await sequelize.query(selectRawQuery, {
      raw: true
    });
    return searchOutput;
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  }
};
