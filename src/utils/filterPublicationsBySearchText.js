import { PanoramaWideAngleSelect } from "@mui/icons-material";
import fullName from "./fullName";

const filterPublicationsBySearchText = (reciterData, search) => {
  const filteredPublications = []
  var scopusTargetAuthorAffiliationScore = 0

  reciterData.forEach((publication) => {
      // Check search and sort
      if(search !== "") {
          if(/^[0-9 ]*$/.test(search)) {
              var pmids = search.split(" ");
              if(pmids.some(pmid => Number(pmid) === publication.pmid )){
                  filteredPublications.push(publication);
              }
          }else {
              var addPublication = true;
              // check filter search
              if (search !== "") {
                  addPublication = false;
                  //pmcid
                  if(publication.pmcid !== undefined && publication.pmcid.toLowerCase().includes(search.toLowerCase())) {
                      addPublication = true
                  }
                  //pmid
                  if(publication.pmid !== undefined && publication.pmid === search.toLowerCase()) {
                    addPublication = true
                  }
                  //publicationTypeCanonical
                  if(publication.publicationType !== undefined && publication.publicationType.publicationTypeCanonical !== undefined &&  publication.publicationType.publicationTypeCanonical.toLowerCase().includes(search.toLowerCase())) {
                      addPublication = true
                  }
                  //scopusDocID
                  if(publication.scopusDocID !== undefined && publication.scopusDocID.toLowerCase().includes(search.toLowerCase())) {
                      addPublication = true
                  }
                  //journalTitleISOabbreviation
                  if(publication.journalTitleISOabbreviation !== undefined && publication.journalTitleISOabbreviation.toLowerCase().includes(search.toLowerCase())) {
                      addPublication = true
                  }
                  //journalTitleVerbose
                  if(publication.journalTitleVerbose !== undefined && publication.journalTitleVerbose.toLowerCase().includes(search.toLowerCase())) {
                      addPublication = true
                  }
                  //publication date display
                  if(publication.publicationDateDisplay !== undefined && publication.publicationDateDisplay.toLowerCase().includes(search.toLowerCase())) {
                      addPublication = true
                  }
                  //doi
                  if(publication.doi !== undefined && publication.doi.toLowerCase().includes(search.toLowerCase())) {
                      addPublication = true
                  }
                  // title
                  if (publication.articleTitle.toLowerCase().includes(search.toLowerCase())) {
                      addPublication = true;
                  }
                  //issn
                  if(publication.issn !== undefined) {
                      var issnArray = publication.issn.map((issn, issnIndex) => {
                          return issn.issn
                      })
                      if(issnArray.join().toLowerCase().includes(search.toLowerCase())) {
                          addPublication = true;
                      }
                  }
                  // authors
                  if (publication.reCiterArticleAuthorFeatures !== undefined) {
                      var authorsArray = publication.reCiterArticleAuthorFeatures.map(function (author, authorIndex) {
                          return fullName(author);
                      });
                      if (authorsArray.join().toLowerCase().includes(search.toLowerCase())) {
                          addPublication = true;
                      }
                  }
                  //evidence
                  if (publication.evidence !== undefined) {
                    // Relationships
                    if (publication.evidence.relationshipEvidence?.relationshipPositiveMatch) {
                      let relationshipEvidence = [];
                      publication.evidence.relationshipEvidence.relationshipPositiveMatch.forEach((relationshipItem) =>{
                        relationshipItem.relationshipType.map((relationshipType) => {
                          relationshipEvidence.push(relationshipType);
                        })
                        relationshipEvidence.push(relationshipItem.relationshipNameArticle.firstName);
                        relationshipEvidence.push(relationshipItem.relationshipNameArticle.lastName);                        
                      })
                      if (relationshipEvidence.join().toLowerCase().includes(search.toLowerCase())) {
                        addPublication = true;
                      }
                    }
                    // Authors
                    if (publication.evidence.authorNameEvidence) {
                      let authorEvidence = [];
                      authorEvidence.push(publication.evidence.authorNameEvidence.articleAuthorName)
                      if (authorEvidence.join().toLowerCase().includes(search.toLowerCase())) {
                        addPublication = true;
                      }
                    }
                    // Email
                    if (publication.evidence.email) {
                      if (publication.evidence.email.emailMatchScore.toString().includes(search.toLowerCase())) {
                        addPublication = true;
                      }
                      if (publication.evidence.emailEvidence.emailMatch.includes(search.toLowerCase())) {
                        addPublication = true;
                      }
                    }
                    // Email 
                    if (publication.evidence) {
                      if (publication.evidence.emailEvidence?.emailMatchScore.toString().includes(search.toLowerCase())) {
                        addPublication = true;
                      }
                      if (publication.evidence.emailEvidence?.emailMatch.includes(search.toLowerCase())) {
                        addPublication = true;
                      }
                    }
                    //Affiliation
                    if (publication.evidence.affiliationEvidence) {
                      if (publication.evidence.affiliationEvidence?.scopusTargetAuthorAffiliation) {
                        let affiliationEvidenceList = [];
                        let matchType = ''
                        publication.evidence.affiliationEvidence.scopusTargetAuthorAffiliation.forEach((scopusTargetAuthorAffiliation) => {
                          scopusTargetAuthorAffiliationScore = scopusTargetAuthorAffiliationScore + scopusTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationMatchTypeScore
                          if(scopusTargetAuthorAffiliation.hasOwnProperty('targetAuthorInstitutionalAffiliationMatchType')) {
                            if(scopusTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationMatchType === 'POSITIVE_MATCH_INDIVIDUAL') {
                                matchType = 'Individual Affiliation'
                            } else if(scopusTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationMatchType === 'POSITIVE_MATCH_INSTITUTION') {
                                matchType = 'Institutional Collaborator'
                            } else if(scopusTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationMatchType === 'NULL_MATCH') {
                                matchType = 'No data available'
                            } else {
                                matchType = 'No Match'
                            }
                          }
      
                          let targetAuthorInstitutionalAffiliationIdentity = ''
                          if (scopusTargetAuthorAffiliation.hasOwnProperty('targetAuthorInstitutionalAffiliationIdentity')) {
                            targetAuthorInstitutionalAffiliationIdentity = scopusTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationIdentity
                          }
      
                          if (matchType !== 'No data available') {
                            let targetAuthorInstitutionalAffiliationArticleScopusLabel = ''
                            if (scopusTargetAuthorAffiliation.hasOwnProperty('targetAuthorInstitutionalAffiliationArticleScopusLabel')) {
                                targetAuthorInstitutionalAffiliationArticleScopusLabel = scopusTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationArticleScopusLabel
                            }
                            affiliationEvidenceList.push(scopusTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationArticleScopusAffiliationId);
                            affiliationEvidenceList.push(targetAuthorInstitutionalAffiliationArticleScopusLabel);
                            if (affiliationEvidenceList.join().toLowerCase().includes(search.toLowerCase())) {
                              addPublication = true;
                            }
                          }
                        })
                      }
                      if (publication.evidence.affiliationEvidence?.pubmedTargetAuthorAffiliation) {
                        let pubmedEvidence = [];
                        let pubmedTargetAuthorAffiliationScore = 0

                        pubmedTargetAuthorAffiliationScore = Number(publication.evidence.affiliationEvidence.pubmedTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationMatchTypeScore)
                        pubmedEvidence.push(pubmedTargetAuthorAffiliationScore);
                        let totalScore = Math.abs(scopusTargetAuthorAffiliationScore + pubmedTargetAuthorAffiliationScore)
                        pubmedEvidence.push(totalScore.toString());
                        if (pubmedEvidence.join().toLowerCase().includes(search.toLowerCase())) {
                          addPublication = true;
                        }
                      }
                    }

                    // Organizational Unit
                    if (publication.evidence.organizationalUnitEvidence) {
                      let orgUnitEvidence = [];
                      let itemCount = 0
                      publication.evidence.organizationalUnitEvidence.forEach((orgUnitItem) => {
                        itemCount++
                        if(itemCount === 1) {
                          orgUnitEvidence.push(orgUnitItem.articleAffiliation)
                        }
                      })
                      if (orgUnitEvidence.join().toLowerCase().includes(search.toLowerCase())) {
                        addPublication = true;
                      }
                    }

                    // Journal Category
                    if (publication.evidence.journalCategoryEvidence) {
                      let journalCategoryEvidence = [];
                      journalCategoryEvidence.push(publication.evidence.journalCategoryEvidence.journalSubfieldScienceMetrixLabel);
                      if (journalCategoryEvidence.join().toLowerCase().includes(search.toLowerCase())) {
                        addPublication = true;
                      }
                    }

                    // Education Year Evidence
                    if (publication.evidence.educationYearEvidence) {
                      let educationYearEvidence = [];
                      educationYearEvidence.push(publication.evidence.educationYearEvidence.articleYear);
                      if (educationYearEvidence.join().toLowerCase().includes(search.toLowerCase())) {
                        addPublication = true;
                      }
                    }

                    // CLustering Evidence 
                    if (publication.evidence.averageClusteringEvidence) {
                      if (publication.evidence.averageClusteringEvidence.totalArticleScoreWithoutClustering.toString().includes(search.toLowerCase()) || publication.evidence.averageClusteringEvidence.clusterScoreAverage.toString().includes(search.toLowerCase())) {
                        addPublication = true;
                      }
                    }

                    // Gender Evidence
                    if (publication.evidence.genderEvidence) {
                      let genderEvidence = [];
                      if(publication.evidence.genderEvidence.hasOwnProperty('genderScoreArticle')) {
                        if(Number(publication.evidence.genderEvidence.genderScoreArticle) >= 0.5) {
                          genderEvidence.push('Male - ' + (Number(publication.evidence.genderEvidence.genderScoreArticle) * 100) + '% probability')
                        } else {
                          genderEvidence.push('Female - ' + ((1 - Number(publication.evidence.genderEvidence.genderScoreArticle)) * 100) + '% probability')
                        }
                      }
                      if (genderEvidence.join().toLowerCase().includes(search.toLowerCase())) {
                        addPublication = true;
                      }
                    }

                    //Person Type evidence
                    if(publication.evidence.personTypeEvidence) {
                      if (publication.evidence.personTypeEvidence.personType.toLowerCase().includes(search.toLowerCase())) {
                        addPublication = true;
                      }
                    }
                  }
                  // if (publication.evidence !== undefined) {
                  //     var evidenceArticleArray = publication.evidence.map(function (evidence, evidenceIndex) {
                  //         return evidence.articleData;
                  //     });
                  //     var evidenceInstArray = publication.evidence.map(function (evidence, evidenceIndex) {
                  //         return evidence.institutionalData;
                  //     });
                  //     if (evidenceInstArray.join().toLowerCase().includes(search.toLowerCase())) {
                  //         addPublication = true;
                  //     }
                  //     if (evidenceArticleArray.join().toLowerCase().includes(search.toLowerCase())) {
                  //         addPublication = true;
                  //     }
                  // }
              }
              if (addPublication) {
                  filteredPublications.push(publication);
              }
          }
      } else {
          filteredPublications.push(publication);
      }
  })
  return filteredPublications;
}

export default filterPublicationsBySearchText;