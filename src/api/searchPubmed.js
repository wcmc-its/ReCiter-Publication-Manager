const request = require('request')
var httpBuildQuery = require('http-build-query') 
const searchPubmedEndpoint = require('../../config/local').config.reciterPubmed.searchPubmedEndpoint
const searchPubmedCountEndpoint = require('../../config/local').config.reciterPubmed.searchPubmedCountEndpoint
var htmlspecialchars = require('htmlspecialchars');
var dateFormat = require('dateformat');
const searchPubmed = (req, cb) => {
    return request({
        uri: `${searchPubmedCountEndpoint}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'reciter-pub-manager-server'
        },
        body: JSON.stringify(req.body)
    }, (error, res, body) => {
        if(error) {
            const apiError = 'Pubmed search api is unreachable at the moment'
            return cb(apiError, null)
        }
        if(body !== undefined) {
            if(parseInt(body, 10) <= 200) {
                request({
                    uri: `${searchPubmedEndpoint}`,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'reciter-pub-manager-server'
                    },
                    body: JSON.stringify(req.body)
                }, function (error, response, body) {
                    if (error) {
                        return cb(error, null)
                    }
                    let data = JSON.parse(body)
                    //const knownRelationships = data.knownRelationships.filter(relationship => relationship.type === 'CO_INVESTIGATOR')
                    return cb(null, formatPubmedSearch(data))
                    
            
                });
            } else {
                const limitExceededError = {
                    limit: parseInt(body, 10),
                    message: 'Your search exceeded 200 results. Please narrow down search'
                }
                return cb(limitExceededError, null)
            }
        }
    })
}

function formatPubmedSearch(data) {
    var PublicationsReciter = []
    if(data !== undefined) {
        data.forEach(article => {
            if(article.medlinecitation !== undefined) {
                let authors = []
                let rank = 1
                let pmid = ''
                if(article.medlinecitation.medlinecitationpmid !== undefined && article.medlinecitation.medlinecitationpmid.pmid !== undefined) {
                    pmid = article.medlinecitation.medlinecitationpmid.pmid
                }
                if(article.medlinecitation.article !== undefined) {
                    if(article.medlinecitation.article.authorlist !== undefined 
                        && Array.isArray(article.medlinecitation.article.authorlist)
                        && article.medlinecitation.article.authorlist.length > 0) {
                            article.medlinecitation.article.authorlist.forEach(author => {
                                let foreName = ''
                                let lastName = ''
                                if(author.hasOwnProperty('forename')) {
                                    foreName = author.forename
                                }
                                if(author.hasOwnProperty('lastname')) {
                                    lastName = author.lastname
                                }
                                authors.push({
                                    'rank': rank++,
                                    'authorName': foreName + ' ' + lastName
                                })
                            })
                    }
                    let month = '01'

                    if(article.medlinecitation.article.journal.journalissue.pubdate.hasOwnProperty('month')) {
                        month = article.medlinecitation.article.journal.journalissue.pubdate.month
                    }

                    let date = article.medlinecitation.article.journal.journalissue.pubdate.year +'/' + month + '/01' 

                    let Publication = {
                        'pmid': pmid,
                        'authors': authors,
                        'title': htmlspecialchars(article.medlinecitation.article.articletitle),
                        'journal': htmlspecialchars(article.medlinecitation.article.journal.title),
                        'displayDate': dateFormat(date, 'yyyy mmm dd')
                    }
                    PublicationsReciter.push(Publication)
                }

                
            }
        })
    }
    return PublicationsReciter
}

module.exports.searchPubmed = searchPubmed