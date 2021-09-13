const request = require('request')
var httpBuildQuery = require('http-build-query') 
const adminApiKey = require('../../config/local').config.reciter.adminApiKey
const featureGeneratorEndpoint = require('../../config/local').config.reciter.featureGenerator.featureGeneratorEndpoint
const featureGeneratorApiParams = require('../../config/local').config.reciter.featureGenerator.featutreGeneratorApiParams
const url = require('url')

const getPublications = (req, cb) => {
    let uri = featureGeneratorEndpoint+ '?uid=' + req.params.uid + '&' + httpBuildQuery(featureGeneratorApiParams)
    if(req.query !== undefined) {
        if(req.query.analysisRefreshFlag !== undefined && req.query.retrievalRefreshFlag !== undefined) {
            uri = featureGeneratorEndpoint+ '?uid=' + req.params.uid + '&' + httpBuildQuery(req.query)
            clearPendingFeedback(req.params.uid, req, (clearPendingData) => {
                console.log(clearPendingData)
            })
        }
    }
    //console.log(uri)
    return request({
        
        headers: {
            'api-key': adminApiKey,
            'User-Agent': 'reciter-pub-manager-server'
        },
        uri: uri,
        method: 'GET'
    }, function (error, response, body) {
        if (error) {
            return cb(error, null)
        }
        if(response.statusCode != 200) {
            console.log('ReCiter Feature Generator api is not reachable: ' + body)
            const apiError = {
                status: response.statusCode,
                error: body
            }
            return cb(apiError, null)
        }
        if(response.statusCode == 200) {
            let data = JSON.parse(body)
            let formattedData = formatPublications(data)
            getPendingFeedback(req.params.uid, formattedData, req, (reciterData) => {
                return cb(null, reciterData)
            })
        }   
    });

}

function clearPendingFeedback(uid, req, callback) 
{
    request({
        uri: fullUrl(req, '/api/reciter/delete/userfeedback/' + uid),
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'reciter-pub-manager-server'
        }
    }, (error, res, body) => {
        if (error) {
            callback(error)
        }
        if(res.statusCode != 200) {
            console.log('ReCiter Delete Feedback api is not reachable: ' + body)
            const apiError = {
                status: res.statusCode,
                error: body
            }
            callback(apiError)
        }
        if(res.statusCode == 200 && body !== undefined) {
            callback(body)
        }
    })
}

function getPendingFeedback(uid, data, req, callback) {
    let reciterData = {}
    request({
        uri: fullUrl(req, '/api/reciter/find/userfeedback/' + uid),
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'reciter-pub-manager-server'
        }
    }, (error, res, body) => {
        if (error) {
            console.log(error)
            reciterData =  {'reciterData': data, 'reciterPendingData': []}
        }
        if(res.statusCode != 200) {
            console.log('ReCiter Get User Feedback api is not reachable: ' + body)
            const apiError = {
                status: res.statusCode,
                error: body
            }
            reciterData =  {'reciterData': data, 'reciterPendingData': []}
        }
        if (res.statusCode == 200 && body !== undefined) {
            body = JSON.parse(body)
            let pendingPublications = []
            if(body.userFeedback.acceptedPmids !== undefined) {
                body.userFeedback.acceptedPmids.forEach(acceptedPmid => {
                    let foundIndex = data.findIndex(item => item.pmid == acceptedPmid)
                    data[foundIndex].userAssertion = 'ACCEPTED'
                    pendingPublications.push(
                        data[foundIndex]
                    )
                })
            }
            if(body.userFeedback.rejectedPmids !== undefined) {
                body.userFeedback.rejectedPmids.forEach(rejectedPmid => {
                    let foundIndex = data.findIndex(item => item.pmid == rejectedPmid)
                    data[foundIndex].userAssertion = 'REJECTED'
                    pendingPublications.push(
                        data[foundIndex]
                    )
                })
            }
            reciterData = {'reciterData': data, 'reciterPendingData': pendingPublications} 
        }
        callback(reciterData)
    })
}

function formatPublications(data) {
    var PublicationsReciter = []
    if (data.hasOwnProperty('reCiterArticleFeatures')) {
        data.reCiterArticleFeatures.forEach(reciterArticle => {
            var Publication = {
                'pmid': reciterArticle.pmid,
                'title': reciterArticle.articleTitle,
                'journal': reciterArticle.journalTitleVerbose,
                'displayDate': reciterArticle.publicationDateDisplay,
                'standardDate': reciterArticle.publicationDateStandardized,
                'standardScore': reciterArticle.totalArticleScoreStandardized,
                'rawScore': reciterArticle.totalArticleScoreNonStandardized,
                'userAssertion': reciterArticle.userAssertion
            }

            if(reciterArticle.hasOwnProperty('doi')) {
                Publication['doi'] = reciterArticle.doi
            }
            if(reciterArticle.hasOwnProperty('pmcid')) {
                Publication['pmcid'] = reciterArticle.pmcid
            }
            if(reciterArticle.hasOwnProperty('publicationType') && reciterArticle.publicationType.hasOwnProperty('publicationTypeCanonical')) {
                Publication['publicationTypeCanonical'] = reciterArticle.publicationType.publicationTypeCanonical
            }
            if(reciterArticle.hasOwnProperty('scopusDocID')) {
                Publication['scopusDocID'] = reciterArticle.scopusDocID
            }
            if(reciterArticle.hasOwnProperty('journalTitleVerbose')) {
                Publication['journalTitleVerbose'] = reciterArticle.journalTitleVerbose
            }
            if(reciterArticle.hasOwnProperty('journalTitleISOabbreviation')) {
                Publication['journalTitleISOabbreviation'] = reciterArticle.journalTitleISOabbreviation
            }
            if(reciterArticle.hasOwnProperty('issn')) {
                Publication['issn'] = reciterArticle.issn
            }
            //Authors
            if(reciterArticle.hasOwnProperty('reCiterArticleAuthorFeatures')) {
                authors = []
                reciterArticle.reCiterArticleAuthorFeatures.forEach(reciterArticleAuthor => {
                    var authorVerboseName = ((reciterArticleAuthor.firstName!==null)?reciterArticleAuthor.firstName:'') + ' ' + ((reciterArticleAuthor.lastName!==null)?reciterArticleAuthor.lastName:'')
                    authors.push({
                        'rank': reciterArticleAuthor.rank,
                        'authorName': authorVerboseName,
                        'targetAuthor': reciterArticleAuthor.targetAuthor
                    })
                })
                Publication['authors'] = authors
            }
            //Evidence Section
            if(reciterArticle.hasOwnProperty('evidence')) {
                evidence = [];
                //Relationship evidence
                if(reciterArticle.evidence.relationshipEvidence !== undefined && reciterArticle.evidence.relationshipEvidence.hasOwnProperty('relationshipPositiveMatch')) {
                    var weillCornellDataHtml = ''
                    var articleDataHtml = ''
                    if(reciterArticle.evidence.relationshipEvidence.hasOwnProperty('relationshipEvidenceTotalScore')) {
                        var relationshipScoreTotal = reciterArticle.evidence.relationshipEvidence.relationshipEvidenceTotalScore.toFixed(2)
                    }
                    
                    reciterArticle.evidence.relationshipEvidence.relationshipPositiveMatch.forEach(relationshipItem => {
                        weillCornellDataHtml = weillCornellDataHtml + '<p>' + relationshipItem.relationshipNameIdentity.firstName + ' ' + relationshipItem.relationshipNameIdentity.lastName + ' ' + 
                        relationshipItem.relationshipType.map(relationshipType => '<span class="h6fnhWdeg-reciter-type">' + relationshipType + '</span>').join(' ')

                        articleDataHtml = articleDataHtml + '<p>' + relationshipItem.relationshipNameArticle.firstName + ' ' + relationshipItem.relationshipNameArticle.lastName + '</p>'
                    })
                        
                    evidence.push({
                        'score': Number(relationshipScoreTotal),
                        'label': '<p><strong>Relationships</strong><br/><small>' + relationshipScoreTotal + ' points</small></p>',
                        'institutionalData': weillCornellDataHtml,
                        'articleData': articleDataHtml
                    })
                    
                }
                //Email evidence
                if(reciterArticle.evidence.emailEvidence !== undefined) {
                    evidence.push({
                        'score': parseFloat(reciterArticle.evidence.emailEvidence.emailMatchScore),
                        'label': '<p><strong>Email</strong><br/><small>' + Math.round(reciterArticle.evidence.emailEvidence.emailMatchScore * 100 + Number.EPSILON ) / 100 + ' points</small></p>',                        
                        'institutionalData': '<p>' + reciterArticle.evidence.emailEvidence.emailMatch + '</p>',
                        'articleData': '<p>' + reciterArticle.evidence.emailEvidence.emailMatch + '</p>'
                    })
                }
                //Organizational unit evidence
                if(reciterArticle.evidence.organizationalUnitEvidence !== undefined) {
                    weillCornellDataHtml = ''
                    articleDataHtml = ''
                    let scoreTotal = 0
                    let itemCount = 0
                    reciterArticle.evidence.organizationalUnitEvidence.forEach(orgUnitItem => {
                        itemCount++
                        scoreTotal = scoreTotal + Number(orgUnitItem.organizationalUnitMatchingScore + orgUnitItem.organizationalUnitModifierScore)
                        if(orgUnitItem.hasOwnProperty('organizationalUnitType')) {
                            weillCornellDataHtml = weillCornellDataHtml + '<p>' + orgUnitItem.identityOrganizationalUnit + ' <span class="h6fnhWdeg-reciter-type">' + orgUnitItem.organizationalUnitType + '</span></p>'
                        } else {
                            weillCornellDataHtml = weillCornellDataHtml + '<p>' + orgUnitItem.identityOrganizationalUnit + '</p>'
                        }
                        if(itemCount === 1) {
                            articleDataHtml = articleDataHtml + '<p>' + orgUnitItem.articleAffiliation + ' <span class="h6fnhWdeg-reciter-type">Pubmed</span></p>'
                        }
                    }) 
                    evidence.push({
                        'score': Math.abs(scoreTotal),
                        'label': '<p><strong>Departmental affiliation</strong><br/><small>' + Math.round(scoreTotal * 100 + Number.EPSILON ) / 100 + ' points</small></p>',                       
                        'institutionalData': weillCornellDataHtml,
                        'articleData': articleDataHtml
                    })
                }
                //Journal category evidence
                if(reciterArticle.evidence.journalCategoryEvidence !== undefined) {
                    evidence.push({
                        'score': parseFloat(reciterArticle.evidence.journalCategoryEvidence.journalSubfieldScore),
                        'label': '<p><strong>Journal category</strong><br/><small>' + Math.round(reciterArticle.evidence.journalCategoryEvidence.journalSubfieldScore * 100 + Number.EPSILON ) / 100 + ' points</small></p>',
                        'institutionalData': (reciterArticle.evidence.journalCategoryEvidence.journalSubfieldDepartment === 'NO_MATCH')? '<p>-</p>': '<p>' + reciterArticle.evidence.journalCategoryEvidence.journalSubfieldDepartment + ' <span class="h6fnhWdeg-reciter-type">Organizational Unit</span></p>',
                        'articleData': '<p>' + reciterArticle.evidence.journalCategoryEvidence.journalSubfieldScienceMetrixLabel + ' <span class="h6fnhWdeg-reciter-type">Journal Category</span></p>'
                    })
                }
                //Affiliation evidence
                if(reciterArticle.evidence.affiliationEvidence !== undefined) {
                    let scopusTargetAuthorAffiliationScore = 0
                    let pubmedTargetAuthorAffiliationScore = 0
                    let weillCornellDataHtml = ''
                    let articleDataHtml = ''
                    if(reciterArticle.evidence.affiliationEvidence.hasOwnProperty('scopusTargetAuthorAffiliation')) {
                        let matchType = ''
                        reciterArticle.evidence.affiliationEvidence.scopusTargetAuthorAffiliation.forEach(scopusTargetAuthorAffiliation => {
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
                            if(scopusTargetAuthorAffiliation.hasOwnProperty('targetAuthorInstitutionalAffiliationIdentity')) {
                                targetAuthorInstitutionalAffiliationIdentity = scopusTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationIdentity
                            }

                            if(matchType === 'No data available') {
                                weillCornellDataHtml = weillCornellDataHtml + '<p>-</p>'
                                articleDataHtml = articleDataHtml + '<p> <span class="h6fnhWdeg-reciter-type">' + matchType + '</span></p>'
                            } else {
                                weillCornellDataHtml = weillCornellDataHtml + '<p>' + targetAuthorInstitutionalAffiliationIdentity + ' <span class="h6fnhWdeg-reciter-type">' + matchType + '</span></p>'
                                let targetAuthorInstitutionalAffiliationArticleScopusLabel = ''
                                if(scopusTargetAuthorAffiliation.hasOwnProperty('targetAuthorInstitutionalAffiliationArticleScopusLabel')) {
                                    targetAuthorInstitutionalAffiliationArticleScopusLabel = scopusTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationArticleScopusLabel
                                }
                                articleDataHtml = articleDataHtml + '<p>' + targetAuthorInstitutionalAffiliationArticleScopusLabel + ' <a href="https://www.scopus.com/affil/profile.uri?afid=' + scopusTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationArticleScopusAffiliationId + '">' + scopusTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationArticleScopusAffiliationId + '</a> <span class="h6fnhWdeg-reciter-type">Scopus</span></p>'
                            }
                        })
                    }
                    if(reciterArticle.evidence.affiliationEvidence.hasOwnProperty('pubmedTargetAuthorAffiliation')) {
                        let matchType = ''
                        pubmedTargetAuthorAffiliationScore = Number(reciterArticle.evidence.affiliationEvidence.pubmedTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationMatchTypeScore)
                        if(reciterArticle.evidence.affiliationEvidence.pubmedTargetAuthorAffiliation.hasOwnProperty('targetAuthorInstitutionalAffiliationMatchType')) {
                            if(reciterArticle.evidence.affiliationEvidence.pubmedTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationMatchType === 'POSITIVE_MATCH_INDIVIDUAL') {
                                matchType = 'Individual Affiliation'
                            } else if(reciterArticle.evidence.affiliationEvidence.pubmedTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationMatchType === 'POSITIVE_MATCH_INSTITUTION') {
                                matchType = 'Institutional Collaborator'
                            } else if(reciterArticle.evidence.affiliationEvidence.pubmedTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationMatchType === 'NULL_MATCH') {
                                matchType = 'No data available'
                            } else {
                                matchType = 'No Match'
                            }
                        }
                        weillCornellDataHtml = weillCornellDataHtml + '<p>-</p>'
                        articleDataHtml = articleDataHtml + '<p>' + reciterArticle.evidence.affiliationEvidence.pubmedTargetAuthorAffiliation.targetAuthorInstitutionalAffiliationArticlePubmedLabel + ' <span class="h6fnhWdeg-reciter-type">Pubmed</span></p>' 
                    }
                    let totalScore = scopusTargetAuthorAffiliationScore + pubmedTargetAuthorAffiliationScore
                    evidence.push({
                        'score': Math.abs(totalScore),
                        'label': '<p><strong>Target author\'s institutional affiliation</strong><br/><small>' + Math.round(totalScore * 100 + Number.EPSILON ) / 100 + ' points</small></p>',
                        'institutionalData': weillCornellDataHtml,
                        'articleData': articleDataHtml
                    })
                    if(reciterArticle.evidence.affiliationEvidence.scopusNonTargetAuthorAffiliation !==undefined) {
                        weillCornellDataHtml = ''
                        articleDataHtml = ''
                        let scopusNonTargetAuthorAffiliationScore = reciterArticle.evidence.affiliationEvidence.scopusNonTargetAuthorAffiliation.nonTargetAuthorInstitutionalAffiliationScore
                        if(reciterArticle.evidence.affiliationEvidence.scopusNonTargetAuthorAffiliation.nonTargetAuthorInstitutionalAffiliationMatchKnownInstitution !== undefined) {
                            reciterArticle.evidence.affiliationEvidence.scopusNonTargetAuthorAffiliation.nonTargetAuthorInstitutionalAffiliationMatchKnownInstitution.forEach(matchingKnownInst => {
                                let knownInst = matchingKnownInst.split(', ')
                                weillCornellDataHtml = weillCornellDataHtml + '<p>' + knownInst[0] + '<span class="h6fnhWdeg-reciter-type">Individual Affiliation</span></p>'
                                articleDataHtml = articleDataHtml + '<p>' + knownInst[2] + ' author(s) from ' + knownInst[0] + ' <a href="https://www.scopus.com/affil/profile.uri?afid=' + knownInst[1] + '">' + knownInst[1] +  '</a> <span class="h6fnhWdeg-reciter-type">Scopus</span></p>'
                            })
                        }

                        if(reciterArticle.evidence.affiliationEvidence.scopusNonTargetAuthorAffiliation.nonTargetAuthorInstitutionalAffiliationMatchCollaboratingInstitution !== undefined) {
                            reciterArticle.evidence.affiliationEvidence.scopusNonTargetAuthorAffiliation.nonTargetAuthorInstitutionalAffiliationMatchCollaboratingInstitution.forEach(matchingCollabInst => {
                                let collabInst = matchingCollabInst.split(', ')
                                weillCornellDataHtml = weillCornellDataHtml + '<p>' + collabInst[0] + '<span class="h6fnhWdeg-reciter-type">Collaborating Institution</span></p>'
                                articleDataHtml = articleDataHtml + '<p>' + collabInst[2] + ' author(s) from ' + collabInst[0] + ' <a href="https://www.scopus.com/affil/profile.uri?afid=' + collabInst[1] + '">' + collabInst[1] +  '</a> <span class="h6fnhWdeg-reciter-type">Scopus</span></p>'
                            })
                        }
                        evidence.push({
                            'score': Math.abs(scopusNonTargetAuthorAffiliationScore),
                            'label': '<p><strong>Co-author\'s institutional affiliation</strong><br/><small>' + Math.round(scopusNonTargetAuthorAffiliationScore * 100 + Number.EPSILON ) / 100 + ' points</small></p>',
                            'institutionalData': weillCornellDataHtml,
                            'articleData': articleDataHtml
                        })

                    }
                }
                //Grants evidence
                if(reciterArticle.evidence.hasOwnProperty('grantEvidence')) {
                    let scoreTotal = 0
                    let weillCornellDataHtml = ''
                    let articleDataHtml = ''
                    if(reciterArticle.evidence.grantEvidence.grants !== undefined && reciterArticle.evidence.grantEvidence.grants.length > 0) {
                        reciterArticle.evidence.grantEvidence.grants.forEach(grant => {
                            scoreTotal = scoreTotal + grant.grantMatchScore
                            weillCornellDataHtml = weillCornellDataHtml + '<p>' + grant.institutionGrant + '</p>'
                            articleDataHtml = articleDataHtml + '<p>' + grant.articleGrant + '</p>'
                        })
                        evidence.push({
                            'score': Math.abs(scoreTotal),
                            'label': '<strong>Grants</strong><br/><small>' + Math.round(scoreTotal * 100 + Number.EPSILON ) / 100 + ' points</small></p>',
                            'institutionalData': weillCornellDataHtml,
                            'articleData': articleDataHtml
                        })
                    }
                }
                //Person Type evidence
                if(reciterArticle.evidence.hasOwnProperty('personTypeEvidence')) {
                    evidence.push({
                        'score': Math.abs(reciterArticle.evidence.personTypeEvidence.personTypeScore),
                        'label': '<strong>Person type</strong><br/><small>' + Math.round(reciterArticle.evidence.personTypeEvidence.personTypeScore * 100 + Number.EPSILON ) / 100 + ' points</small></p>',
                        'institutionalData': '<p>' + reciterArticle.evidence.personTypeEvidence.personType + '</p>',
                        'articleData': '<p>-</p>'
                    })
                } 
                //Article count evidence
                if(reciterArticle.evidence.hasOwnProperty('articleCountEvidence')) {
                    evidence.push({
                        'score': Math.abs(reciterArticle.evidence.articleCountEvidence.articleCountScore),
                        'label': '<strong>Candidate article count</strong><br/><small>' + Math.round(reciterArticle.evidence.articleCountEvidence.articleCountScore * 100 + Number.EPSILON ) / 100 + ' points</small></p>',
                        'institutionalData': '<p>-</p>', 
                        'articleData': '<p>' + reciterArticle.evidence.articleCountEvidence.countArticlesRetrieved + '</p>',
                    })
                }
                //Degree year evidence
                if(reciterArticle.evidence.hasOwnProperty('educationYearEvidence')) {
                    let weillCornellDataHtml = []
                    if(reciterArticle.evidence.educationYearEvidence.identityBachelorYear !== undefined) {
                        weillCornellDataHtml.push(reciterArticle.evidence.educationYearEvidence.identityBachelorYear + ' - Bachelors')
                    }
                    if(reciterArticle.evidence.educationYearEvidence.identityDoctoralYear !== undefined) {
                        weillCornellDataHtml.push(reciterArticle.evidence.educationYearEvidence.identityDoctoralYear + ' - Doctoral')
                    }

                    evidence.push({
                        'score': Math.abs(reciterArticle.evidence.educationYearEvidence.discrepancyDegreeYearBachelorScore + reciterArticle.evidence.educationYearEvidence.discrepancyDegreeYearDoctoralScore),
                        'label': '<strong>Degree year discrepancy</strong><br/><small>'  + Math.round((reciterArticle.evidence.educationYearEvidence.discrepancyDegreeYearBachelorScore + reciterArticle.evidence.educationYearEvidence.discrepancyDegreeYearDoctoralScore) * 100 + Number.EPSILON ) / 100 + ' points</small></p>',
                        'institutionalData': '<p>' + weillCornellDataHtml.join(', ') +'</p>', 
                        'articleData': '<p>' + reciterArticle.evidence.educationYearEvidence.articleYear + '</p>',
                    })
                }
                //Clustering evidence
                if(reciterArticle.evidence.hasOwnProperty('averageClusteringEvidence')) {
                    evidence.push({
                        'score': Math.abs(reciterArticle.evidence.averageClusteringEvidence.clusterScoreModificationOfTotalScore),
                        'label': '<strong>Clustering</strong><br/><small>' + Math.round(reciterArticle.evidence.averageClusteringEvidence.clusterScoreModificationOfTotalScore * 100 + Number.EPSILON ) / 100 + ' points</small></p>',
                        'institutionalData': '<p>-</p>', 
                        'articleData': '<p>Score of article without clustering: ' + reciterArticle.evidence.averageClusteringEvidence.totalArticleScoreWithoutClustering + '</p><p>Average score of cluster: ' + reciterArticle.evidence.averageClusteringEvidence.clusterScoreAverage + '</p>'
                    })
                }
                //Gender Strategy
                if(reciterArticle.evidence.hasOwnProperty('genderEvidence')) {
                    let weillCornellDataHtml = ''
                    let articleDataHtml = ''
                    if(reciterArticle.evidence.genderEvidence.hasOwnProperty('genderScoreArticle')) {
                        if(Number(reciterArticle.evidence.genderEvidence.genderScoreArticle) >= 0.5) {
                            articleDataHtml = 'Male - ' + (Number(reciterArticle.evidence.genderEvidence.genderScoreArticle) * 100) + '% probability'
                        } else {
                            articleDataHtml = 'Female - ' + ((1 - Number(reciterArticle.evidence.genderEvidence.genderScoreArticle)) * 100) + '% probability'
                        }
                    }
                    if(reciterArticle.evidence.genderEvidence.hasOwnProperty('genderScoreIdentity')) {
                        if(Number(reciterArticle.evidence.genderEvidence.genderScoreIdentity) >= 0.5) {
                            weillCornellDataHtml = 'Male - ' + (Number(reciterArticle.evidence.genderEvidence.genderScoreIdentity) * 100) + '% probability'
                        } else {
                            weillCornellDataHtml = 'Female - ' + ((1 - Number(reciterArticle.evidence.genderEvidence.genderScoreIdentity)) * 100) + '% probability'
                        }
                    }
                    evidence.push({
                        'score': Math.abs(reciterArticle.evidence.genderEvidence.genderScoreIdentityArticleDiscrepancy),
                        'label': '<p><strong>Inferred gender of name (<a href="https://data.world/howarder/gender-by-name" target="_blank">source</a>)</strong><br/><small>' + Math.round(reciterArticle.evidence.genderEvidence.genderScoreIdentityArticleDiscrepancy * 100 + Number.EPSILON ) / 100 + ' points</small></p>',
                        'institutionalData': '<p>' + weillCornellDataHtml + '</p>', 
                        'articleData': '<p>' + articleDataHtml + '</p>'
                    })

                }
                //Sort the array
                evidence.sort((a, b) => b.score - a.score)
                //Author name evidence
                if(reciterArticle.evidence.hasOwnProperty('authorNameEvidence')) {
                    let weillCornellAuthorVerboseName = ''
                    let articleAuthorVerboseName = ''

                    weillCornellAuthorVerboseName = reciterArticle.evidence.authorNameEvidence.institutionalAuthorName.firstName + ' ' +
                    ((reciterArticle.evidence.authorNameEvidence.institutionalAuthorName.middleName !== undefined)?reciterArticle.evidence.authorNameEvidence.institutionalAuthorName.middleName + ' ':'') +
                    ((reciterArticle.evidence.authorNameEvidence.institutionalAuthorName.lastName !== undefined)?reciterArticle.evidence.authorNameEvidence.institutionalAuthorName.lastName:'')

                    if(reciterArticle.evidence.authorNameEvidence.hasOwnProperty('articleAuthorName')) {
                        articleAuthorVerboseName = reciterArticle.evidence.authorNameEvidence.articleAuthorName.firstName + ' ' +
                        ((reciterArticle.evidence.authorNameEvidence.articleAuthorName.lastName !== undefined)?reciterArticle.evidence.authorNameEvidence.institutionalAuthorName.lastName:'')
                    }
                    //Place author evidence on top of array
                    evidence.unshift({
                        'score': Math.abs(reciterArticle.evidence.authorNameEvidence.nameScoreTotal),
                        'label': '<p><strong>Name</strong><br/><small>' + Math.round(reciterArticle.evidence.authorNameEvidence.nameScoreTotal * 100 + Number.EPSILON ) / 100 + ' points</small></p>',
                        'institutionalData': weillCornellAuthorVerboseName, 
                        'articleData': articleAuthorVerboseName
                    })
                }
                Publication['evidence'] = evidence
            }
            PublicationsReciter.push(Publication)
        })
    }

    return PublicationsReciter
}

function fullUrl(req, path) {
    return url.format({
        protocol: req.protocol,
        host: req.get('host'),
        pathname: path
    });
}

module.exports.getPublications = getPublications
