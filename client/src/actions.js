import methods from './methods'
import fetchWithTimeout from './fetchWithTimeout';

export const addError = (message) =>
    ({
        type: methods.ADD_ERROR,
        payload: message
    })

export const clearError = index =>
    ({
        type: methods.CLEAR_ERROR,
        payload: index
    })

export const reciterLogin = login => dispatch => {

}

export const identityFetchData = uid => dispatch => {
    dispatch({
        type: methods.IDENTITY_FETCH_DATA
    })
    fetchWithTimeout('/api/reciter/getidentity/' + uid, {
        credentials: "same-origin",
        method: 'GET',
        headers: {
            Accept: 'application/json'
        }
    }, 300000)
        .then(response => {
            if (response.status === 200) {
                return response.json()
            } else {
                throw {
                    type: response.type,
                    title: response.statusText,
                    status: response.status,
                    detail: "En error occurred. Please, try again later."
                }
            }
        })
        .then(data => {
            dispatch({
                type: methods.IDENTITY_CHANGE_DATA,
                payload: data.identity
            })

            dispatch({
                type: methods.IDENTITY_CANCEL_FETCHING
            })
        })
        .catch(error => {
            console.log(error)

            dispatch(
                addError(error)
            )

            dispatch({
                type: methods.IDENTITY_CANCEL_FETCHING
            })

        })
}

export const identityFetchAllData = () => dispatch => {
    dispatch({
        type: methods.IDENTITY_FETCH_ALL_DATA
    })
    fetchWithTimeout('/api/reciter/getAllIdentity', {
        credentials: "same-origin",
        method: 'GET',
        headers: {
            Accept: 'application/json'
        }
    }, 300000)
        .then(response => {
            if (response.status === 200) {
                return response.json()
            } else {
                throw {
                    type: response.type,
                    title: response.statusText,
                    status: response.status,
                    detail: "En error occurred. Please, try again later."
                }
            }
        })
        .then(data => {
            dispatch({
                type: methods.IDENTITY_CHANGE_ALL_DATA,
                payload: data.identity
            })

            dispatch({
                type: methods.IDENTITY_CANCEL_ALL_FETCHING
            })
        })
        .catch(error => {
            console.log(error)

            dispatch(
                addError(error)
            )

            dispatch({
                type: methods.IDENTITY_CANCEL_ALL_FETCHING
            })

        })
}

export const reciterFetchData = (uid, refresh) => dispatch => {

    dispatch({
        type: methods.RECITER_FETCH_DATA
    })

    var url = '/api/reciter/feature-generator/' + uid
    if (refresh) {
        url += '?analysisRefreshFlag=true&retrievalRefreshFlag=ONLY_NEWLY_ADDED_PUBLICATIONS'
    }
    fetchWithTimeout(url, {
        credentials: "same-origin",
        method: 'GET',
        headers: {
            Accept: 'application/json'
        }
    }, 300000)
        .then(response => {
            if (response.status === 200) {
                return response.json()
            } else {
                throw {
                    type: response.type,
                    title: response.statusText,
                    status: response.status,
                    detail: "En error occurred. Please, try again later."
                }
            }
        })
        .then(data => {
            dispatch({
                type: methods.RECITER_CHANGE_DATA,
                payload: data
            })

            dispatch({
                type: methods.RECITER_CANCEL_FETCHING
            })
        })
        .catch(error => {

            dispatch(
                addError(error)
            )

            dispatch({
                type: methods.RECITER_CANCEL_FETCHING
            })

        })

}

export const pubmedFetchData = query => dispatch => {
    dispatch({
        type: methods.PUBMED_FETCH_DATA
    })
    fetchWithTimeout('/api/reciter/search/pubmed', {
        credentials: "same-origin",
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(query)
    }, 300000)
        .then(response => {
            if (response.status === 200) {
                return response.json()
            } else {
                throw {
                    type: response.type,
                    title: response.statusText,
                    status: response.status,
                    detail: "En error occurred. Please, try again later."
                }
            }
        })
        .then(data => {
            dispatch({
                type: methods.PUBMED_CHANGE_DATA,
                payload: data.reciter
            })

            dispatch({
                type: methods.PUBMED_CANCEL_FETCHING
            })
        })
        .catch(error => {

            dispatch(
                addError(error)
            )

            dispatch({
                type: methods.PUBMED_CANCEL_FETCHING
            })

        })

}

export const reciterUpdatePublication = (uid, request) => dispatch => {

    // Update publications' user assertions state
    request.publications.forEach(function (id) {
        switch (request.userAssertion) {
            case "ACCEPTED":
                dispatch({
                    type: methods.ACCEPT_PUBLICATION,
                    payload: id,
                    manuallyAddedFlag: request.manuallyAddedFlag
                })
                break
            case "REJECTED":
                dispatch({
                    type: methods.REJECT_PUBLICATION,
                    payload: id,
                    manuallyAddedFlag: request.manuallyAddedFlag
                })
                break
            case "NULL":
                dispatch({
                    type: methods.UNDO_PUBLICATION,
                    payload: id
                })
                break
        }
    })

    // Send request to the API to update publications
    var facultyUserName = "";
    /* if(request.faculty !== undefined) {
        if(request.faculty.firstName !== undefined) {
            facultyUserName += request.faculty.firstName + ' ';
        }
        if(request.faculty.middleName !== undefined) {
            facultyUserName += request.faculty.middleName + ' ';
        }
        if(request.faculty.lastName !== undefined) {
            facultyUserName += request.faculty.lastName + ' ';
        }
    } */

    facultyUserName = request.faculty.primaryName.firstName + ((request.faculty.primaryName.middleName !== undefined) ? ' ' + request.faculty.primaryName.middleName + ' ' : ' ') + request.faculty.primaryName.lastName

    if (request.userAssertion === 'ACCEPTED' && !request.manuallyAddedFlag) {
        var goldStandard = {
            "auditLog": [
                {
                    "action": request.userAssertion,
                    "dateTime": new Date(),
                    "pmids": request.publications,
                    "uid": uid,
                    "userVerbose": facultyUserName
                }
            ],
            "knownPmids": request.publications,
            "uid": uid
        };
    } else if (request.userAssertion === 'REJECTED' && !request.manuallyAddedFlag) {
        var goldStandard = {
            "auditLog": [
                {
                    "action": request.userAssertion,
                    "dateTime": new Date(),
                    "pmids": request.publications,
                    "uid": uid,
                    "userVerbose": facultyUserName
                }
            ],
            "rejectedPmids": request.publications,
            "uid": uid
        };
    } else if (request.userAssertion === 'NULL' && !request.manuallyAddedFlag) {
        var goldStandard = {
            "auditLog": [
                {
                    "action": request.userAssertion,
                    "dateTime": new Date(),
                    "pmids": request.publications,
                    "uid": uid,
                    "userVerbose": facultyUserName
                }
            ],
            "knownPmids": request.publications,
            "rejectedPmids": request.publications,
            "uid": uid
        };
    } else if (request.userAssertion === 'ACCEPTED' && request.manuallyAddedFlag) {
        var goldStandard = {
            "auditLog": [
                {
                    "action": request.userAssertion,
                    "dateTime": new Date(),
                    "pmids": [request.publications[0].pmid],
                    "uid": uid,
                    "userVerbose": facultyUserName
                }
            ],
            "knownPmids": [request.publications[0].pmid],
            "uid": uid
        };
    } else if (request.userAssertion === 'REJECTED' && request.manuallyAddedFlag) {
        var goldStandard = {
            "auditLog": [
                {
                    "action": request.userAssertion,
                    "dateTime": new Date(),
                    "pmids": [request.publications[0].pmid],
                    "uid": uid,
                    "userVerbose": facultyUserName
                }
            ],
            "rejectedPmids": [request.publications[0].pmid],
            "uid": uid
        };
    }


    var url = '/api/reciter/update/goldstandard?goldStandardUpdateFlag=UPDATE';
    if (request.userAssertion === 'NULL') {
        url = '/api/reciter/update/goldstandard?goldStandardUpdateFlag=DELETE'
    }

    fetchWithTimeout(url, {
        credentials: "same-origin",
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(goldStandard)
    }, 300000)
        .then(response => {
            if (response.status === 200) {
                return response.json()
            } else {
                throw {
                    type: response.type,
                    title: response.statusText,
                    status: response.status,
                    detail: "En error occurred. Please, try again later."
                }
            }
        })
        .catch(error => {

            dispatch(
                addError(error)
            )

            dispatch({
                type: methods.RECITER_CANCEL_FETCHING
            })

        })

}

export const authUser = auth => dispatch => {
    return fetchWithTimeout('/users/reciter/authentication', {
        credentials: "same-origin",
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(auth)
    }, 300000)
        .then(r => r.json())
        .then(results => {
            if (!results.success) {
                return dispatch({
                    type: methods.USER_LOGOUT,
                })
            }
            return dispatch({
                type: methods.USER_LOGIN,
                auth: {
                    username: results.data.username || '',
                    isLoggedIn: results.success || false,
                    accessToken: results.data.accessToken
                }
            })
        })
        .catch(err => {
            return dispatch(
                addError(err)
            )
        })
}

export const storeUsername = username => ({
    type: methods.USER_LOGIN,
    auth: {
        username: username,
        isLoggedIn: true
    }
})

export const getSession = sid => dispatch => {
    dispatch({
        type: methods.GET_SESSION_ID,
        payload: 'test'
    })
    return fetch('/users/getSession')
        .then(r => {
            console.log(r)
        })
        // .then(r => r.json())
        // .then(response => {
        //     console.log(`got response`)
        //     console.log(response)
        //     dispatch({
        //         type: methods.GET_SESSION_ID,
        //         payload: 'test'
        //     })
        // })
        .catch(err => {
            console.log(err)
            return dispatch(
                addError(err)
            )
        })
}

export const updateDeptsPersonTypes = (deptTypes, personTypes) => dispatch => {
    console.log("action update depts", deptTypes, personTypes)
    dispatch({
        type: methods.UPDATE_PERSON_TYPES,
        payload: personTypes
    })
    dispatch({
        type: methods.UPDATE_DEPT_TYPES,
        payload: deptTypes
    })
}

const responseData = [
    {
        "personIdentifier": "paa2013",
        "dateAdded": "2020-02-19T23:26:17.890+0000",
        "dateUpdated": "2020-02-19T23:26:17.890+0000",
        "mode": "AS_EVIDENCE",
        "overallAccuracy": 0.6016042780748663,
        "precision": 0.29411764705882354,
        "recall": 0.9090909090909091,
        "inGoldStandardButNotRetrieved": [
            0
        ],
        "countSuggestedArticles": 34,
        "reCiterArticleFeatures": [
            {
                "pmid": 31258448,
                "pmcid": "PMC6579602",
                "totalArticleScoreStandardized": 10,
                "totalArticleScoreNonStandardized": 12.58,
                "userAssertion": "NULL",
                "publicationDateDisplay": "2019 Jul 01",
                "publicationDateStandardized": "2019-07-01",
                "datePublicationAddedToEntrez": "2019-07-02",
                "doi": "10.5195/jmla.2019.401",
                "publicationType": {
                    "publicationTypeCanonical": "Academic Article",
                    "publicationTypePubMed": [
                        "Journal Article"
                    ],
                    "publicationTypeScopus": {
                        "publicationTypeScopusAbbreviation": "ar",
                        "publicationTypeScopusLabel": "Article"
                    }
                },
                "publicationAbstract": "Background: The US National Institutes of Health (NIH) funds academic institutions for training doctoral (PhD) students and postdoctoral fellows. These training grants, known as T32 grants, require schools to create, in a particular format, seven or eight Word documents describing the program and its participants. Weill Cornell Medicine aimed to use structured name and citation data to dynamically generate tables, thus saving administrators time. Case Presentation: The author's team collected identity and publication metadata from existing systems of record, including our student information system and previous T32 submissions. These data were fed into our ReCiter author disambiguation engine. Well-structured bibliographic metadata, including the rank of the target author, were output and stored in a MySQL database. We then ran a database query that output a Word extensible markup (XML) document according to NIH's specifications. We generated the T32 training document using a query that ties faculty listed on a grant submission with publications that they and their mentees authored, bolding author names as required. Because our source data are well-structured and well-defined, the only parameter needed in the query is a single identifier for the grant itself. The open source code for producing this document is at http://dx.doi.org/10.5281/zenodo.2593545. Conclusions: Manually writing a table for T32 grant submissions is a substantial administrative burden; some documents generated in this manner exceed 150 pages. Provided they have a source for structured identity and publication data, administrators can use the T32 Table Generator to readily output a table.",
                "scopusDocID": "85068959101",
                "journalTitleVerbose": "Journal of the Medical Library Association : JMLA",
                "issn": [
                    {
                        "issntype": "Electronic",
                        "issn": "1558-9439"
                    },
                    {
                        "issntype": "Linking",
                        "issn": "1536-5050"
                    }
                ],
                "journalTitleISOabbreviation": "J Med Libr Assoc",
                "articleTitle": "Dynamically generating T32 training documents using structured data.",
                "reCiterArticleAuthorFeatures": [
                    {
                        "rank": 1,
                        "lastName": "Albert",
                        "firstName": "Paul James",
                        "initials": "P",
                        "targetAuthor": true
                    },
                    {
                        "rank": 2,
                        "lastName": "Joshi",
                        "firstName": "Ayesha",
                        "initials": "A",
                        "targetAuthor": false
                    }
                ],
                "volume": "107",
                "issue": "3",
                "pages": "420-424",
                "evidence": {
                    "acceptedRejectedEvidence": {
                        "feedbackScoreNull": 0
                    },
                    "authorNameEvidence": {
                        "institutionalAuthorName": {
                            "firstName": "Paul",
                            "firstInitial": "P",
                            "middleName": "J",
                            "middleInitial": "J",
                            "lastName": "Albert"
                        },
                        "articleAuthorName": {
                            "firstName": "Paul James",
                            "firstInitial": "P",
                            "lastName": "Albert"
                        },
                        "nameScoreTotal": 4.511,
                        "nameMatchFirstType": "full-exact",
                        "nameMatchFirstScore": 1.852,
                        "nameMatchMiddleType": "exact-singleInitial",
                        "nameMatchMiddleScore": 1.191,
                        "nameMatchLastType": "full-exact",
                        "nameMatchLastScore": 0.664,
                        "nameMatchModifier": "identitySubstringOfArticle-firstMiddleName",
                        "nameMatchModifierScore": 0.804
                    },
                    "emailEvidence": {
                        "emailMatch": "palbert1@gmail.com",
                        "emailMatchScore": 8
                    },
                    "journalCategoryEvidence": {
                        "journalSubfieldScienceMetrixLabel": "Information & Library Sciences",
                        "journalSubfieldScienceMetrixID": 75,
                        "journalSubfieldDepartment": "Library",
                        "journalSubfieldScore": 1.88
                    },
                    "affiliationEvidence": {
                        "scopusTargetAuthorAffiliation": [
                            {
                                "targetAuthorInstitutionalAffiliationSource": "SCOPUS",
                                "targetAuthorInstitutionalAffiliationArticleScopusLabel": "Samuel J. Wood Library",
                                "targetAuthorInstitutionalAffiliationArticleScopusAffiliationId": 118359069,
                                "targetAuthorInstitutionalAffiliationMatchType": "NO_MATCH",
                                "targetAuthorInstitutionalAffiliationMatchTypeScore": -0.8
                            }
                        ],
                        "pubmedTargetAuthorAffiliation": {
                            "targetAuthorInstitutionalAffiliationArticlePubmedLabel": "Samuel J. Wood Library, Weill Cornell Medicine, New York, NY, paa2013@med.cornell.edu.",
                            "targetAuthorInstitutionalAffiliationMatchTypeScore": 0
                        },
                        "scopusNonTargetAuthorAffiliation": {
                            "nonTargetAuthorInstitutionalAffiliationSource": "SCOPUS",
                            "nonTargetAuthorInstitutionalAffiliationMatchKnownInstitution": [
                                "Weill Graduate School of Medical Sciences, 60000247, 1"
                            ],
                            "nonTargetAuthorInstitutionalAffiliationScore": 0.9
                        }
                    },
                    "relationshipEvidence": {
                        "relationshipEvidenceTotalScore": -0.05,
                        "relationshipNegativeMatch": {
                            "relationshipNonMatchCount": 1,
                            "relationshipNonMatchScore": -0.048,
                            "relationshipMinimumTotalScore": -1.592
                        }
                    },
                    "educationYearEvidence": {
                        "identityBachelorYear": 1997,
                        "articleYear": 2019,
                        "discrepancyDegreeYearBachelor": 22,
                        "discrepancyDegreeYearBachelorScore": 0,
                        "discrepancyDegreeYearDoctoralScore": 0
                    },
                    "personTypeEvidence": {
                        "personType": "academic-faculty-weillfulltime",
                        "personTypeScore": 0.6
                    },
                    "genderEvidence": {
                        "genderScoreArticle": 1,
                        "genderScoreIdentity": 1,
                        "genderScoreIdentityArticleDiscrepancy": 0.24
                    },
                    "articleCountEvidence": {
                        "countArticlesRetrieved": 697,
                        "articleCountScore": 0.176400068504881
                    },
                    "averageClusteringEvidence": {
                        "totalArticleScoreWithoutClustering": 15.46,
                        "clusterScoreAverage": 9.26,
                        "clusterReliabilityScore": 0.7,
                        "clusterScoreModificationOfTotalScore": -2.87,
                        "clusterIdentifier": 7
                    }
                }
            }
        ]
    },
    {
        "personIdentifier": "alerner",
        "dateAdded": "2020-02-20T06:51:41.733+0000",
        "dateUpdated": "2020-02-20T06:51:41.733+0000",
        "mode": "AS_EVIDENCE",
        "overallAccuracy": 0,
        "precision": 0,
        "recall": 0,
        "countSuggestedArticles": 22,
        "reCiterArticleFeatures": [
            {
                "pmid": 20950720,
                "pmcid": "PMC3032022",
                "totalArticleScoreStandardized": 6,
                "totalArticleScoreNonStandardized": 2.97,
                "userAssertion": "NULL",
                "publicationDateDisplay": "2010 Oct 13",
                "publicationDateStandardized": "2010-10-13",
                "datePublicationAddedToEntrez": "2010-10-19",
                "doi": "10.1016/j.bone.2010.10.003",
                "publicationType": {
                    "publicationTypeCanonical": "Academic Article",
                    "publicationTypePubMed": [
                        "Journal Article",
                        "Research Support, N.I.H., Extramural"
                    ],
                    "publicationTypeScopus": {
                        "publicationTypeScopusAbbreviation": "ar",
                        "publicationTypeScopusLabel": "Article"
                    }
                },
                "timesCited": 42,
                "publicationAbstract": "Despite the remarkable healing potential of long bone fractures, traumatic injuries that result in critical defects require challenging reconstructive limb sparing surgery. While devitalized allografts are the gold standard for these procedures, they are prone to failure due to their limited osseointegration with the host. Thus, the quest for adjuvants to enhance allograft healing remains a priority for this unmet clinical need. To address this, we investigated the effects of daily systemic injections of 40 μg/kg teriparatide (recombinant human parathyroid hormone) on the healing of devitalized allografts used to reconstruct critical femoral defects (4mm) in C57Bl/6 mice. The femurs were evaluated at 4 and 6 weeks using micro CT, histology, and torsion testing. Our findings demonstrated that teriparatide induced prolonged cartilage formation at the graft-host junction at 4 weeks, which led to enhanced trabeculated bone callus formation and remarkable graft-host integration at 6-weeks. Moreover, we observed a significant 2-fold increase in normalized callus volume (1.04 ± 0.3 vs. 0.54 ± 0.14 mm³/mm; p < 0.005), and Union Ratio (0.28 ± 0.07 vs. 0.13 ± 0.09; p < 0.005), compared to saline treated controls at 6-weeks. Teriparatide treatment significantly increased the torsional rigidity (1175 ± 311 versus 585 ± 408 N.mm²) and yield torque (10.5 ± 4.2 versus 6.8 ± 5.5 N.mm) compared to controls. Interestingly, the Union Ratio correlated significantly with the yield torque and torsional rigidity (R²=0.59 and R²=0.77, p < 0.001, respectively). These results illustrate the remarkable potential of teriparatide as an adjuvant therapy for allograft repair in a mouse model of massive femoral defect reconstruction, and warrant further investigation in a larger animal model at longer time intervals to justify future clinical trials for PTH therapy in limb sparing reconstructive procedures.",
                "scopusDocID": "79751524079",
                "journalTitleVerbose": "Bone",
                "issn": [
                    {
                        "issntype": "Electronic",
                        "issn": "1873-2763"
                    },
                    {
                        "issntype": "Linking",
                        "issn": "1873-2763"
                    }
                ],
                "journalTitleISOabbreviation": "Bone",
                "articleTitle": "Teriparatide therapy enhances devitalized femoral allograft osseointegration and biomechanics in a murine model.",
                "reCiterArticleAuthorFeatures": [
                    {
                        "rank": 1,
                        "lastName": "Reynolds",
                        "firstName": "David G",
                        "initials": "D",
                        "targetAuthor": false
                    },
                    {
                        "rank": 2,
                        "lastName": "Takahata",
                        "firstName": "Masahiko",
                        "initials": "M",
                        "targetAuthor": false
                    },
                    {
                        "rank": 3,
                        "lastName": "Lerner",
                        "firstName": "Amy L",
                        "initials": "A",
                        "targetAuthor": true
                    },
                    {
                        "rank": 4,
                        "lastName": "O'Keefe",
                        "firstName": "Regis J",
                        "initials": "R",
                        "targetAuthor": false
                    },
                    {
                        "rank": 5,
                        "lastName": "Schwarz",
                        "firstName": "Edward M",
                        "initials": "E",
                        "targetAuthor": false
                    },
                    {
                        "rank": 6,
                        "lastName": "Awad",
                        "firstName": "Hani A",
                        "initials": "H",
                        "targetAuthor": false
                    }
                ],
                "volume": "48",
                "issue": "3",
                "pages": "562-70",
                "evidence": {
                    "acceptedRejectedEvidence": {
                        "feedbackScoreNull": 0
                    },
                    "authorNameEvidence": {
                        "institutionalAuthorName": {
                            "firstName": "Adele",
                            "firstInitial": "A",
                            "middleName": "A.",
                            "middleInitial": "A",
                            "lastName": "Lerner"
                        },
                        "articleAuthorName": {
                            "firstName": "Amy L",
                            "firstInitial": "A",
                            "lastName": "Lerner"
                        },
                        "nameScoreTotal": 0.6100000000000001,
                        "nameMatchFirstType": "noMatch",
                        "nameMatchFirstScore": -0.441,
                        "nameMatchMiddleType": "exact-singleInitial",
                        "nameMatchMiddleScore": 1.191,
                        "nameMatchLastType": "full-exact",
                        "nameMatchLastScore": 0.664,
                        "nameMatchModifier": "identitySubstringOfArticle-middleName",
                        "nameMatchModifierScore": -0.804
                    },
                    "affiliationEvidence": {
                        "scopusTargetAuthorAffiliation": [
                            {
                                "targetAuthorInstitutionalAffiliationSource": "SCOPUS",
                                "targetAuthorInstitutionalAffiliationIdentity": "University of Rochester",
                                "targetAuthorInstitutionalAffiliationArticleScopusLabel": "University of Rochester",
                                "targetAuthorInstitutionalAffiliationArticleScopusAffiliationId": 60027165,
                                "targetAuthorInstitutionalAffiliationMatchType": "POSITIVE_MATCH_INDIVIDUAL",
                                "targetAuthorInstitutionalAffiliationMatchTypeScore": 1.8
                            }
                        ],
                        "scopusNonTargetAuthorAffiliation": {
                            "nonTargetAuthorInstitutionalAffiliationSource": "SCOPUS",
                            "nonTargetAuthorInstitutionalAffiliationMatchKnownInstitution": [
                                "University of Rochester, 60027165, 5"
                            ],
                            "nonTargetAuthorInstitutionalAffiliationScore": 0.9
                        }
                    },
                    "relationshipEvidence": {
                        "relationshipEvidenceTotalScore": 0,
                        "relationshipNegativeMatch": {
                            "relationshipNonMatchCount": 0,
                            "relationshipNonMatchScore": -0.048,
                            "relationshipMinimumTotalScore": -1.592
                        }
                    },
                    "educationYearEvidence": {
                        "identityBachelorYear": 1960,
                        "articleYear": 2010,
                        "discrepancyDegreeYearBachelor": 50,
                        "discrepancyDegreeYearBachelorScore": 0,
                        "discrepancyDegreeYearDoctoralScore": 0
                    },
                    "genderEvidence": {
                        "genderScoreArticle": 0,
                        "genderScoreIdentity": 0,
                        "genderScoreIdentityArticleDiscrepancy": 0.24
                    },
                    "articleCountEvidence": {
                        "countArticlesRetrieved": 1033,
                        "articleCountScore": -0.39904093166638127
                    },
                    "averageClusteringEvidence": {
                        "totalArticleScoreWithoutClustering": 3.15,
                        "clusterScoreAverage": 2.88,
                        "clusterReliabilityScore": 1,
                        "clusterScoreModificationOfTotalScore": -0.18,
                        "clusterIdentifier": 353
                    }
                }
            },
            {
                "pmid": 20725979,
                "pmcid": "PMC2958236",
                "totalArticleScoreStandardized": 6,
                "totalArticleScoreNonStandardized": 2.93,
                "userAssertion": "NULL",
                "publicationDateDisplay": "2010 Dec 01",
                "publicationDateStandardized": "2010-12-01",
                "datePublicationAddedToEntrez": "2010-08-21",
                "doi": "10.1002/jbm.a.32868",
                "publicationType": {
                    "publicationTypeCanonical": "Academic Article",
                    "publicationTypePubMed": [
                        "Evaluation Studies",
                        "Journal Article",
                        "Research Support, N.I.H., Extramural",
                        "Research Support, Non-U.S. Gov't"
                    ],
                    "publicationTypeScopus": {
                        "publicationTypeScopusAbbreviation": "ar",
                        "publicationTypeScopusLabel": "Article"
                    }
                },
                "timesCited": 34,
                "publicationAbstract": "Advances in biomaterial fabrication have introduced numerous innovations in designing scaffolds for bone tissue engineering. Often, the focus has been on fabricating scaffolds with high and interconnected porosity that would allow for cellular seeding and tissue ingrowth. However, such scaffolds typically lack the mechanical strength to sustain in vivo ambulatory stresses in models of load bearing cortical bone reconstruction. In this study, we investigated the microstructural and mechanical properties of dense PLA and PLA/beta-TCP (85:15) scaffolds fabricated using a rapid volume expansion phase separation technique, which embeds uncoated beta-TCP particles within the porous polymer. PLA scaffolds had a volumetric porosity in the range of 30 to 40%. With the embedding of beta-TCP mineral particles, the porosity of the scaffolds was reduced in half, whereas the ultimate compressive and torsional strength were significantly increased. We also investigated the properties of the scaffolds as delivery vehicles for growth factors in vitro and in vivo. The low-surface porosity resulted in sub optimal retention efficiency of the growth factors, and burst release kinetics reflecting surface coating rather than volumetric entrapment, regardless of the scaffold used. When loaded with BMP2 and VEGF and implanted in the quadriceps muscle, PLA/beta-TCP scaffolds did not induce ectopic mineralization but induced a significant 1.8-fold increase in neo vessel formation. In conclusion, dense PLA/beta-TCP scaffolds can be engineered with enhanced mechanical properties and potentially be exploited for localized therapeutic factor delivery.",
                "scopusDocID": "78249270409",
                "journalTitleVerbose": "Journal of biomedical materials research. Part A",
                "issn": [
                    {
                        "issntype": "Electronic",
                        "issn": "1552-4965"
                    },
                    {
                        "issntype": "Linking",
                        "issn": "1549-3296"
                    }
                ],
                "journalTitleISOabbreviation": "J Biomed Mater Res A",
                "articleTitle": "Evaluation of dense polylactic acid/beta-tricalcium phosphate scaffolds for bone tissue engineering.",
                "reCiterArticleAuthorFeatures": [
                    {
                        "rank": 1,
                        "lastName": "Yanoso-Scholl",
                        "firstName": "Laura",
                        "initials": "L",
                        "targetAuthor": false
                    },
                    {
                        "rank": 2,
                        "lastName": "Jacobson",
                        "firstName": "Justin A",
                        "initials": "J",
                        "targetAuthor": false
                    },
                    {
                        "rank": 3,
                        "lastName": "Bradica",
                        "firstName": "Gino",
                        "initials": "G",
                        "targetAuthor": false
                    },
                    {
                        "rank": 4,
                        "lastName": "Lerner",
                        "firstName": "Amy L",
                        "initials": "A",
                        "targetAuthor": true
                    },
                    {
                        "rank": 5,
                        "lastName": "O'Keefe",
                        "firstName": "Regis J",
                        "initials": "R",
                        "targetAuthor": false
                    },
                    {
                        "rank": 6,
                        "lastName": "Schwarz",
                        "firstName": "Edward M",
                        "initials": "E",
                        "targetAuthor": false
                    },
                    {
                        "rank": 7,
                        "lastName": "Zuscik",
                        "firstName": "Michael J",
                        "initials": "M",
                        "targetAuthor": false
                    },
                    {
                        "rank": 8,
                        "lastName": "Awad",
                        "firstName": "Hani A",
                        "initials": "H",
                        "targetAuthor": false
                    }
                ],
                "volume": "95",
                "issue": "3",
                "pages": "717-26",
                "evidence": {
                    "acceptedRejectedEvidence": {
                        "feedbackScoreNull": 0
                    },
                    "authorNameEvidence": {
                        "institutionalAuthorName": {
                            "firstName": "Adele",
                            "firstInitial": "A",
                            "middleName": "A.",
                            "middleInitial": "A",
                            "lastName": "Lerner"
                        },
                        "articleAuthorName": {
                            "firstName": "Amy L",
                            "firstInitial": "A",
                            "lastName": "Lerner"
                        },
                        "nameScoreTotal": 0.6100000000000001,
                        "nameMatchFirstType": "noMatch",
                        "nameMatchFirstScore": -0.441,
                        "nameMatchMiddleType": "exact-singleInitial",
                        "nameMatchMiddleScore": 1.191,
                        "nameMatchLastType": "full-exact",
                        "nameMatchLastScore": 0.664,
                        "nameMatchModifier": "identitySubstringOfArticle-middleName",
                        "nameMatchModifierScore": -0.804
                    },
                    "affiliationEvidence": {
                        "scopusTargetAuthorAffiliation": [
                            {
                                "targetAuthorInstitutionalAffiliationSource": "SCOPUS",
                                "targetAuthorInstitutionalAffiliationIdentity": "University of Rochester",
                                "targetAuthorInstitutionalAffiliationArticleScopusLabel": "University of Rochester",
                                "targetAuthorInstitutionalAffiliationArticleScopusAffiliationId": 60027165,
                                "targetAuthorInstitutionalAffiliationMatchType": "POSITIVE_MATCH_INDIVIDUAL",
                                "targetAuthorInstitutionalAffiliationMatchTypeScore": 1.8
                            }
                        ],
                        "scopusNonTargetAuthorAffiliation": {
                            "nonTargetAuthorInstitutionalAffiliationSource": "SCOPUS",
                            "nonTargetAuthorInstitutionalAffiliationMatchKnownInstitution": [
                                "University of Rochester, 60027165, 6"
                            ],
                            "nonTargetAuthorInstitutionalAffiliationScore": 0.77
                        }
                    },
                    "relationshipEvidence": {
                        "relationshipEvidenceTotalScore": 0,
                        "relationshipNegativeMatch": {
                            "relationshipNonMatchCount": 0,
                            "relationshipNonMatchScore": -0.048,
                            "relationshipMinimumTotalScore": -1.592
                        }
                    },
                    "educationYearEvidence": {
                        "identityBachelorYear": 1960,
                        "articleYear": 2010,
                        "discrepancyDegreeYearBachelor": 50,
                        "discrepancyDegreeYearBachelorScore": 0,
                        "discrepancyDegreeYearDoctoralScore": 0
                    },
                    "genderEvidence": {
                        "genderScoreArticle": 0,
                        "genderScoreIdentity": 0,
                        "genderScoreIdentityArticleDiscrepancy": 0.24
                    },
                    "articleCountEvidence": {
                        "countArticlesRetrieved": 1033,
                        "articleCountScore": -0.39904093166638127
                    },
                    "averageClusteringEvidence": {
                        "totalArticleScoreWithoutClustering": 3.02,
                        "clusterScoreAverage": 2.88,
                        "clusterReliabilityScore": 1,
                        "clusterScoreModificationOfTotalScore": -0.09,
                        "clusterIdentifier": 353
                    }
                }
            },
            {
                "pmid": 19063685,
                "pmcid": "PMC2672207",
                "totalArticleScoreStandardized": 5,
                "totalArticleScoreNonStandardized": 2.81,
                "userAssertion": "NULL",
                "publicationDateDisplay": "2009 May 01",
                "publicationDateStandardized": "2009-05-01",
                "datePublicationAddedToEntrez": "2008-12-10",
                "doi": "10.1359/jbmr.081232",
                "publicationType": {
                    "publicationTypeCanonical": "Academic Article",
                    "publicationTypePubMed": [
                        "Journal Article",
                        "Research Support, N.I.H., Extramural"
                    ],
                    "publicationTypeScopus": {
                        "publicationTypeScopusAbbreviation": "ar",
                        "publicationTypeScopusLabel": "Article"
                    }
                },
                "timesCited": 29,
                "publicationAbstract": "Evaluation of structural bone grafts risk of failure requires noninvasive quantitative predictors of functional strength. We hypothesized that a quantitative graft-to-host union biometric would correlate significantly with biomechanical properties as a surrogate for the risk of fracture. To test this, we developed a novel algorithm to compute the union between host callus and graft, which was termed the union ratio. We compared the union ratio of live autografts to devitalized allografts implanted into the mid-diaphysis of mouse femurs for 6 and 9 wk. Surprisingly, the autograft union ratio decreased from 0.228 +/- 0.029 at 6 wk to 0.15 +/- 0.011 at 9 wk (p < 0.05) and did not correlate with the torsional properties of the autografts. The allograft union ratio was 0.105 +/- 0.023 at 6 wk but increased to 0.224 +/- 0.029 at 9 wk (p < 0.05). As a single variable, the union ratio correlated significantly with ultimate torque (R (2) = 0.58) and torsional rigidity (R (2) = 0.51) of the allografts. Multivariable regression analyses of allografts that included the union ratio, the graft bone volume, the maximum and minimum polar moment of inertia, and their first-order interaction terms with the union ratio as independent variables resulted in significant correlations with the ultimate torque and torsional rigidity (adjusted R (2) = 0.80 and 0.89, respectively). These results suggest that, unlike live autografts, the union between the devitalized allograft and host contributes significantly to the strength of grafted bone. The union ratio has important clinical implications as a novel biometric for noninvasive assessment of functional strength and failure risk.",
                "scopusDocID": "65949110341",
                "journalTitleVerbose": "Journal of bone and mineral research : the official journal of the American Society for Bone and Mineral Research",
                "issn": [
                    {
                        "issntype": "Electronic",
                        "issn": "1523-4681"
                    },
                    {
                        "issntype": "Linking",
                        "issn": "0884-0431"
                    }
                ],
                "journalTitleISOabbreviation": "J. Bone Miner. Res.",
                "articleTitle": "muCT-based measurement of cortical bone graft-to-host union.",
                "reCiterArticleAuthorFeatures": [
                    {
                        "rank": 1,
                        "lastName": "Reynolds",
                        "firstName": "David G",
                        "initials": "D",
                        "targetAuthor": false
                    },
                    {
                        "rank": 2,
                        "lastName": "Shaikh",
                        "firstName": "Saad",
                        "initials": "S",
                        "targetAuthor": false
                    },
                    {
                        "rank": 3,
                        "lastName": "Papuga",
                        "firstName": "Mark Owen",
                        "initials": "M",
                        "targetAuthor": false
                    },
                    {
                        "rank": 4,
                        "lastName": "Lerner",
                        "firstName": "Amy L",
                        "initials": "A",
                        "targetAuthor": true
                    },
                    {
                        "rank": 5,
                        "lastName": "O'Keefe",
                        "firstName": "Regis J",
                        "initials": "R",
                        "targetAuthor": false
                    },
                    {
                        "rank": 6,
                        "lastName": "Schwarz",
                        "firstName": "Edward M",
                        "initials": "E",
                        "targetAuthor": false
                    },
                    {
                        "rank": 7,
                        "lastName": "Awad",
                        "firstName": "Hani A",
                        "initials": "H",
                        "targetAuthor": false
                    }
                ],
                "volume": "24",
                "issue": "5",
                "pages": "899-907",
                "evidence": {
                    "acceptedRejectedEvidence": {
                        "feedbackScoreNull": 0
                    },
                    "authorNameEvidence": {
                        "institutionalAuthorName": {
                            "firstName": "Adele",
                            "firstInitial": "A",
                            "middleName": "A.",
                            "middleInitial": "A",
                            "lastName": "Lerner"
                        },
                        "articleAuthorName": {
                            "firstName": "Amy L",
                            "firstInitial": "A",
                            "lastName": "Lerner"
                        },
                        "nameScoreTotal": 0.6100000000000001,
                        "nameMatchFirstType": "noMatch",
                        "nameMatchFirstScore": -0.441,
                        "nameMatchMiddleType": "exact-singleInitial",
                        "nameMatchMiddleScore": 1.191,
                        "nameMatchLastType": "full-exact",
                        "nameMatchLastScore": 0.664,
                        "nameMatchModifier": "identitySubstringOfArticle-middleName",
                        "nameMatchModifierScore": -0.804
                    },
                    "journalCategoryEvidence": {
                        "journalSubfieldScienceMetrixLabel": "Anatomy & Morphology",
                        "journalSubfieldScienceMetrixID": 85,
                        "journalSubfieldDepartment": "NO_MATCH",
                        "journalSubfieldScore": -0.47
                    },
                    "affiliationEvidence": {
                        "scopusTargetAuthorAffiliation": [
                            {
                                "targetAuthorInstitutionalAffiliationSource": "SCOPUS",
                                "targetAuthorInstitutionalAffiliationIdentity": "University of Rochester",
                                "targetAuthorInstitutionalAffiliationArticleScopusLabel": "University of Rochester",
                                "targetAuthorInstitutionalAffiliationArticleScopusAffiliationId": 60027165,
                                "targetAuthorInstitutionalAffiliationMatchType": "POSITIVE_MATCH_INDIVIDUAL",
                                "targetAuthorInstitutionalAffiliationMatchTypeScore": 1.8
                            }
                        ],
                        "scopusNonTargetAuthorAffiliation": {
                            "nonTargetAuthorInstitutionalAffiliationSource": "SCOPUS",
                            "nonTargetAuthorInstitutionalAffiliationMatchKnownInstitution": [
                                "University of Rochester, 60027165, 6"
                            ],
                            "nonTargetAuthorInstitutionalAffiliationScore": 0.9
                        }
                    },
                    "relationshipEvidence": {
                        "relationshipEvidenceTotalScore": 0,
                        "relationshipNegativeMatch": {
                            "relationshipNonMatchCount": 0,
                            "relationshipNonMatchScore": -0.048,
                            "relationshipMinimumTotalScore": -1.592
                        }
                    },
                    "educationYearEvidence": {
                        "identityBachelorYear": 1960,
                        "articleYear": 2009,
                        "discrepancyDegreeYearBachelor": 49,
                        "discrepancyDegreeYearBachelorScore": 0,
                        "discrepancyDegreeYearDoctoralScore": 0
                    },
                    "genderEvidence": {
                        "genderScoreArticle": 0,
                        "genderScoreIdentity": 0,
                        "genderScoreIdentityArticleDiscrepancy": 0.24
                    },
                    "articleCountEvidence": {
                        "countArticlesRetrieved": 1033,
                        "articleCountScore": -0.39904093166638127
                    },
                    "averageClusteringEvidence": {
                        "totalArticleScoreWithoutClustering": 2.68,
                        "clusterScoreAverage": 2.88,
                        "clusterReliabilityScore": 1,
                        "clusterScoreModificationOfTotalScore": 0.13,
                        "clusterIdentifier": 353
                    }
                }
            },
            {
                "pmid": 18335716,
                "totalArticleScoreStandardized": 5,
                "totalArticleScoreNonStandardized": 2.81,
                "userAssertion": "NULL",
                "publicationDateDisplay": "2008 Jan 01",
                "publicationDateStandardized": "2008-01-01",
                "datePublicationAddedToEntrez": "2008-03-14",
                "publicationType": {
                    "publicationTypeCanonical": "Academic Article",
                    "publicationTypePubMed": [
                        "Journal Article",
                        "Research Support, Non-U.S. Gov't"
                    ],
                    "publicationTypeScopus": {
                        "publicationTypeScopusAbbreviation": "ar",
                        "publicationTypeScopusLabel": "Article"
                    }
                },
                "timesCited": 12,
                "publicationAbstract": "The objective of this study was to determine tibiofemoral cartilage thickness distribution, and to investigate the relationship between cartilage geometry and anthropometric variables. In this study, 20 magnetic resonance examinations of the knee from normal individuals were reconstructed to provide three-dimensional models of the knee joint, including bony and cartilage surfaces. Three regions were defined on the articular surface, and the cartilage thickness distribution along each of these was determined. Statistically significant differences between femoral and tibial regions were examined using the paired Student t test in Microsoft Excel. Correlations were investigated using the correlation tool in Microsoft Excel. The average tibial cartilage thickness was found to be 2.76 mm and the average femoral cartilage thickness was 2.75 mm. Significant correlations exist between the tibia cartilage thickness and body height (R = 0.60; P < 0.05) and weight (R = 0.64; P < 0.05). Significant correlations exist between the femoral cartilage volume and the body height (R = 0.736; P < 0.01) and weight (R = 0.855; P < 0.01). It is suggested that the distribution and correlations of cartilage distribution indicate adaptation in response to mechanical loading. Information regarding cartilage thickness and volume distribution as found in this study may be useful in diagnosing and monitoring cartilage loss in patients with degenerative joint disease.",
                "scopusDocID": "42049113678",
                "journalTitleVerbose": "Proceedings of the Institution of Mechanical Engineers. Part H, Journal of engineering in medicine",
                "issn": [
                    {
                        "issntype": "Print",
                        "issn": "0954-4119"
                    },
                    {
                        "issntype": "Linking",
                        "issn": "0954-4119"
                    }
                ],
                "journalTitleISOabbreviation": "Proc Inst Mech Eng H",
                "articleTitle": "Tibiofemoral cartilage thickness distribution and its correlation with anthropometric variables.",
                "reCiterArticleAuthorFeatures": [
                    {
                        "rank": 1,
                        "lastName": "Connolly",
                        "firstName": "Aoife",
                        "initials": "A",
                        "targetAuthor": false
                    },
                    {
                        "rank": 2,
                        "lastName": "FitzPatrick",
                        "firstName": "D",
                        "initials": "D",
                        "targetAuthor": false
                    },
                    {
                        "rank": 3,
                        "lastName": "Moulton",
                        "firstName": "J",
                        "initials": "J",
                        "targetAuthor": false
                    },
                    {
                        "rank": 4,
                        "lastName": "Lee",
                        "firstName": "J",
                        "initials": "J",
                        "targetAuthor": false
                    },
                    {
                        "rank": 5,
                        "lastName": "Lerner",
                        "firstName": "A",
                        "initials": "A",
                        "targetAuthor": true
                    }
                ],
                "volume": "222",
                "issue": "1",
                "pages": "29-39",
                "evidence": {
                    "acceptedRejectedEvidence": {
                        "feedbackScoreNull": 0
                    },
                    "authorNameEvidence": {
                        "institutionalAuthorName": {
                            "firstName": "Adele",
                            "firstInitial": "A",
                            "middleName": "A.",
                            "middleInitial": "A",
                            "lastName": "Lerner"
                        },
                        "articleAuthorName": {
                            "firstName": "A",
                            "firstInitial": "A",
                            "lastName": "Lerner"
                        },
                        "nameScoreTotal": 1.4140000000000001,
                        "nameMatchFirstType": "noMatch",
                        "nameMatchFirstScore": -0.441,
                        "nameMatchMiddleType": "exact-singleInitial",
                        "nameMatchMiddleScore": 1.191,
                        "nameMatchLastType": "full-exact",
                        "nameMatchLastScore": 0.664,
                        "nameMatchModifierScore": 0
                    },
                    "affiliationEvidence": {
                        "scopusTargetAuthorAffiliation": [
                            {
                                "targetAuthorInstitutionalAffiliationSource": "SCOPUS",
                                "targetAuthorInstitutionalAffiliationIdentity": "University of Rochester",
                                "targetAuthorInstitutionalAffiliationArticleScopusLabel": "University of Rochester",
                                "targetAuthorInstitutionalAffiliationArticleScopusAffiliationId": 60027165,
                                "targetAuthorInstitutionalAffiliationMatchType": "POSITIVE_MATCH_INDIVIDUAL",
                                "targetAuthorInstitutionalAffiliationMatchTypeScore": 1.8
                            }
                        ]
                    },
                    "relationshipEvidence": {
                        "relationshipEvidenceTotalScore": 0,
                        "relationshipNegativeMatch": {
                            "relationshipNonMatchCount": 0,
                            "relationshipNonMatchScore": -0.048,
                            "relationshipMinimumTotalScore": -1.592
                        }
                    },
                    "educationYearEvidence": {
                        "identityBachelorYear": 1960,
                        "articleYear": 2008,
                        "discrepancyDegreeYearBachelor": 48,
                        "discrepancyDegreeYearBachelorScore": 0,
                        "discrepancyDegreeYearDoctoralScore": 0
                    },
                    "articleCountEvidence": {
                        "countArticlesRetrieved": 1033,
                        "articleCountScore": -0.39904093166638127
                    },
                    "averageClusteringEvidence": {
                        "totalArticleScoreWithoutClustering": 2.81,
                        "clusterScoreAverage": 2.81,
                        "clusterReliabilityScore": 0,
                        "clusterScoreModificationOfTotalScore": 0,
                        "clusterIdentifier": 835
                    }
                }
            },
            {
                "pmid": 17524409,
                "totalArticleScoreStandardized": 5,
                "totalArticleScoreNonStandardized": 2.81,
                "userAssertion": "NULL",
                "publicationDateDisplay": "2007 May 23",
                "publicationDateStandardized": "2007-05-23",
                "datePublicationAddedToEntrez": "2007-05-26",
                "publicationType": {
                    "publicationTypeCanonical": "Academic Article",
                    "publicationTypePubMed": [
                        "Journal Article",
                        "Research Support, N.I.H., Extramural",
                        "Research Support, Non-U.S. Gov't"
                    ],
                    "publicationTypeScopus": {
                        "publicationTypeScopusAbbreviation": "ar",
                        "publicationTypeScopusLabel": "Article"
                    }
                },
                "timesCited": 49,
                "publicationAbstract": "Correlating massive bone graft strength to parameters derived from non-invasive imaging is important for pre-clinical and clinical evaluation of therapeutic adjuvants designed to improve graft repair. Towards that end, univariate and multivariate regression between measures of graft and callus geometry from micro-CT imaging and torsional strength and rigidity were investigated in a mouse femoral graft model. Four millimeter mid-diaphyseal defects were grafted with live autografts or processed allografts and allowed to heal for 6, 9, 12, or 18 weeks. We observed that allograft remodeling and incorporation into the host remained severely impaired compared to autografts mainly due to the extent of callus formation around the graft, the rate and extent of the graft resorption, and the degree of union between the graft and host bone as judged by post-mechanical testing analysis of the mode of failure. The autografts displayed greater ultimate torque and torsional rigidity compared to the allografts over time. However the biomechanical properties of allografts were equivalent to autografts by 9 weeks but significantly decreased at 12 and 18 weeks. Multivariate regression analysis demonstrated significant statistical correlations between combinations of the micro-CT parameters (graft and callus volume and cross-sectional polar moment of inertia) with the measured ultimate torque and torsional rigidity (adjusted R(2)=44% and 50%, respectively). The statistical correlations approach used in this mouse study could be useful in guiding future development of non-invasive predictors of the biomechanical properties of allografts using clinical CT.",
                "scopusDocID": "34948884021",
                "journalTitleVerbose": "Journal of biomechanics",
                "issn": [
                    {
                        "issntype": "Print",
                        "issn": "0021-9290"
                    },
                    {
                        "issntype": "Linking",
                        "issn": "0021-9290"
                    }
                ],
                "journalTitleISOabbreviation": "J Biomech",
                "articleTitle": "Micro-computed tomography prediction of biomechanical strength in murine structural bone grafts.",
                "reCiterArticleAuthorFeatures": [
                    {
                        "rank": 1,
                        "lastName": "Reynolds",
                        "firstName": "David G",
                        "initials": "D",
                        "targetAuthor": false
                    },
                    {
                        "rank": 2,
                        "lastName": "Hock",
                        "firstName": "Colleen",
                        "initials": "C",
                        "targetAuthor": false
                    },
                    {
                        "rank": 3,
                        "lastName": "Shaikh",
                        "firstName": "Saad",
                        "initials": "S",
                        "targetAuthor": false
                    },
                    {
                        "rank": 4,
                        "lastName": "Jacobson",
                        "firstName": "Justin",
                        "initials": "J",
                        "targetAuthor": false
                    },
                    {
                        "rank": 5,
                        "lastName": "Zhang",
                        "firstName": "Xinping",
                        "initials": "X",
                        "targetAuthor": false
                    },
                    {
                        "rank": 6,
                        "lastName": "Rubery",
                        "firstName": "Paul T",
                        "initials": "P",
                        "targetAuthor": false
                    },
                    {
                        "rank": 7,
                        "lastName": "Beck",
                        "firstName": "Christopher A",
                        "initials": "C",
                        "targetAuthor": false
                    },
                    {
                        "rank": 8,
                        "lastName": "O'keefe",
                        "firstName": "Regis J",
                        "initials": "R",
                        "targetAuthor": false
                    },
                    {
                        "rank": 9,
                        "lastName": "Lerner",
                        "firstName": "Amy L",
                        "initials": "A",
                        "targetAuthor": true
                    },
                    {
                        "rank": 10,
                        "lastName": "Schwarz",
                        "firstName": "Edward M",
                        "initials": "E",
                        "targetAuthor": false
                    },
                    {
                        "rank": 11,
                        "lastName": "Awad",
                        "firstName": "Hani A",
                        "initials": "H",
                        "targetAuthor": false
                    }
                ],
                "volume": "40",
                "issue": "14",
                "pages": "3178-86",
                "evidence": {
                    "acceptedRejectedEvidence": {
                        "feedbackScoreNull": 0
                    },
                    "authorNameEvidence": {
                        "institutionalAuthorName": {
                            "firstName": "Adele",
                            "firstInitial": "A",
                            "middleName": "A.",
                            "middleInitial": "A",
                            "lastName": "Lerner"
                        },
                        "articleAuthorName": {
                            "firstName": "Amy L",
                            "firstInitial": "A",
                            "lastName": "Lerner"
                        },
                        "nameScoreTotal": 0.6100000000000001,
                        "nameMatchFirstType": "noMatch",
                        "nameMatchFirstScore": -0.441,
                        "nameMatchMiddleType": "exact-singleInitial",
                        "nameMatchMiddleScore": 1.191,
                        "nameMatchLastType": "full-exact",
                        "nameMatchLastScore": 0.664,
                        "nameMatchModifier": "identitySubstringOfArticle-middleName",
                        "nameMatchModifierScore": -0.804
                    },
                    "journalCategoryEvidence": {
                        "journalSubfieldScienceMetrixLabel": "Biomedical Engineering",
                        "journalSubfieldScienceMetrixID": 21,
                        "journalSubfieldDepartment": "NO_MATCH",
                        "journalSubfieldScore": -0.47
                    },
                    "affiliationEvidence": {
                        "scopusTargetAuthorAffiliation": [
                            {
                                "targetAuthorInstitutionalAffiliationSource": "SCOPUS",
                                "targetAuthorInstitutionalAffiliationIdentity": "University of Rochester",
                                "targetAuthorInstitutionalAffiliationArticleScopusLabel": "University of Rochester",
                                "targetAuthorInstitutionalAffiliationArticleScopusAffiliationId": 60027165,
                                "targetAuthorInstitutionalAffiliationMatchType": "POSITIVE_MATCH_INDIVIDUAL",
                                "targetAuthorInstitutionalAffiliationMatchTypeScore": 1.8
                            }
                        ],
                        "scopusNonTargetAuthorAffiliation": {
                            "nonTargetAuthorInstitutionalAffiliationSource": "SCOPUS",
                            "nonTargetAuthorInstitutionalAffiliationMatchKnownInstitution": [
                                "University of Rochester, 60027165, 10"
                            ],
                            "nonTargetAuthorInstitutionalAffiliationScore": 0.9
                        }
                    },
                    "relationshipEvidence": {
                        "relationshipEvidenceTotalScore": 0,
                        "relationshipNegativeMatch": {
                            "relationshipNonMatchCount": 0,
                            "relationshipNonMatchScore": -0.048,
                            "relationshipMinimumTotalScore": -1.592
                        }
                    },
                    "educationYearEvidence": {
                        "identityBachelorYear": 1960,
                        "articleYear": 2007,
                        "discrepancyDegreeYearBachelor": 47,
                        "discrepancyDegreeYearBachelorScore": 0,
                        "discrepancyDegreeYearDoctoralScore": 0
                    },
                    "genderEvidence": {
                        "genderScoreArticle": 0,
                        "genderScoreIdentity": 0,
                        "genderScoreIdentityArticleDiscrepancy": 0.24
                    },
                    "articleCountEvidence": {
                        "countArticlesRetrieved": 1033,
                        "articleCountScore": -0.39904093166638127
                    },
                    "averageClusteringEvidence": {
                        "totalArticleScoreWithoutClustering": 2.68,
                        "clusterScoreAverage": 2.88,
                        "clusterReliabilityScore": 1,
                        "clusterScoreModificationOfTotalScore": 0.13,
                        "clusterIdentifier": 353
                    }
                }
            }
        ]
    }
]

export const getGroupReviewSuggestions = (deptTypes, personTypes, cb) => dispatch => {
    console.log("deptTypes in review", deptTypes)
    dispatch({
        type: methods.GROUP_BY_FETCH_ALL_DATA,
        payload: responseData
    })
    cb()
    // fetchWithTimeout('/reciter/feature-generator/by/group?personType=' + String(personTypes) + '&departmentalAffiliation=' + String(deptTypes) + '&totalStandardizedArticleScore=4&maxArticlesPerPerson=5', {
    //     // fetchWithTimeout('/reciter/feature-generator/by/group?personType=academic-faculty&departmentalAffiliation=Library&totalStandardizedArticleScore=4&maxArticlesPerPerson=5', {
    //     credentials: "same-origin",
    //     method: 'GET',
    //     headers: {
    //         Accept: 'application/json',
    //         "api-key": "9edd88cf-4806-49d8-bc14-5a7e4cc4ccf8"
    //     }
    // }, 300000)
    //     .then(response => {
    //         if (response.status === 200) {

    //             return response.json()
    //         } else {
    //             throw {
    //                 type: response.type,
    //                 title: response.statusText,
    //                 status: response.status,
    //                 detail: "En error occurred. Please, try again later."
    //             }
    //         }
    //     })
    //     .then(data => {
    //         console.log("response in message", data, cb)
    //         cb(data)
    //         dispatch({
    //             type: methods.GROUP_BY_FETCH_ALL_DATA,
    //             payload: data
    //         })
    //         // dispatch({
    //         //     type: methods.IDENTITY_CHANGE_ALL_DATA,
    //         //     payload: data.identity
    //         // })

    //         // dispatch({
    //         //     type: methods.IDENTITY_CANCEL_ALL_FETCHING
    //         // })
    //     })
    //     .catch(error => {
    //         console.log(error)

    //         dispatch(
    //             addError(error)
    //         )

    //         dispatch({
    //             type: methods.IDENTITY_CANCEL_ALL_FETCHING
    //         })

    //     })

}