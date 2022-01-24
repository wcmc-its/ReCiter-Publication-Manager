const filterPublications = (reciterData, tabType, search) => {
  const filteredPublications = []
  reciterData.reciter.reCiterArticleFeatures.forEach((publication) => {
    // Check publication status
    if(publication.userAssertion === tabType) {
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
                    //publicationTypeCanonical
                    if(publication.publicationTypeCanonical !== undefined && publication.publicationTypeCanonical.toLowerCase().includes(search.toLowerCase())) {
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
                    if(publication.displayDate !== undefined && publication.displayDate.toLowerCase().includes(search.toLowerCase())) {
                        addPublication = true
                    }
                    //doi
                    if(publication.doi !== undefined && publication.doi.toLowerCase().includes(search.toLowerCase())) {
                        addPublication = true
                    }
                    // title
                    if (publication.title.toLowerCase().includes(search.toLowerCase())) {
                        addPublication = true;
                    }
                    // journal
                    if (publication.journal.toLowerCase().includes(search.toLowerCase())) {
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
                    if (publication.authors !== undefined) {
                        var authorsArray = publication.authors.map(function (author, authorIndex) {
                            return author.authorName;
                        });
                        if (authorsArray.join().toLowerCase().includes(search.toLowerCase())) {
                            addPublication = true;
                        }
                    }
                    //evidence
                    if (publication.evidence !== undefined) {
                        var evidenceArticleArray = publication.evidence.map(function (evidence, evidenceIndex) {
                            return evidence.articleData;
                        });
                        var evidenceInstArray = publication.evidence.map(function (evidence, evidenceIndex) {
                            return evidence.institutionalData;
                        });
                        if (evidenceInstArray.join().toLowerCase().includes(search.toLowerCase())) {
                            addPublication = true;
                        }
                        if (evidenceArticleArray.join().toLowerCase().includes(search.toLowerCase())) {
                            addPublication = true;
                        }
                    }
                }
                if (addPublication) {
                    filteredPublications.push(publication);
                }
            }
        }else {
            filteredPublications.push(publication);
        }
    }
  })
  return filteredPublications;
}

export default filterPublications;