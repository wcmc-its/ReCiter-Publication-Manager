import { reciterConfig } from '../config/local'
import { NextApiRequest } from 'next'
import dayjs from 'dayjs'

export async function searchPubmed(req: NextApiRequest)  {
    
   return fetch(`${reciterConfig.reciterPubmed.searchPubmedCountEndpoint}`, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'reciter-pub-manager-server'
        },
        body: JSON.stringify(req.body)
    })
        .then(async(res)=> {
            if(res.status !== 200) {
                let responseText = await res.json()
                return {
                    statusCode: res.status,
                    statusText: responseText
                }
            } else {
                let data: any = await res.json()
                if(parseInt(data, 10) <= 200) {
                    return fetch(`${reciterConfig.reciterPubmed.searchPubmedEndpoint}`, {
                        method: "POST",
                        headers: {
                            'Content-Type': 'application/json',
                            'User-Agent': 'reciter-pub-manager-server'
                        },
                        body: JSON.stringify(req.body)
                    })
                    .then(async (res) => {
                        let data: any = await res.json()
                        return {
                            statusCode: res.status,
                            statusText: formatPubmedSearch(data)
                        }
                     })
                     .catch((error) => {
                         console.log('ReCiter Pubmed api is not reachable: ' + error)
                         return {
                            statusCode: error.status,
                            statusText: error
                        }
                     });
                } else {
                    const message:string = "Your search exceeded 200 results: " + parseInt(data, 10) + ". Please narrow down search."
                    const limitExceededError = {
                        limit: parseInt(data, 10),
                        message: message,
                        status: 500
                    }
                    return {
                        statusCode: res.status,
                        statusText: limitExceededError
                    }
                }
            }
        })
        .catch((error) => {
            console.log('ReCiter Identity api is not reachable: ' + error)
            return {
                statusCode: error.status,
                statusText: error
            }
        });
}


function formatPubmedSearch(data: any) {
    const PublicationsReciter: any[] = []
    if(data !== undefined) {
        data.forEach((article: any) => {
            if(article.medlinecitation !== undefined) {
                let authors: any[] = []
                let rank = 1
                let pmid = ''
                if(article.medlinecitation.medlinecitationpmid !== undefined && article.medlinecitation.medlinecitationpmid.pmid !== undefined) {
                    pmid = article.medlinecitation.medlinecitationpmid.pmid
                }
                if(article.medlinecitation.article !== undefined) {
                    if(article.medlinecitation.article.authorlist !== undefined 
                        && Array.isArray(article.medlinecitation.article.authorlist)
                        && article.medlinecitation.article.authorlist.length > 0) {
                            article.medlinecitation.article.authorlist.forEach((author: any) => {
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
                    let formattedDate = dayjs(date).format('YYYY MMM DD')
                    let Publication = {
                        'pmid': pmid,
                        'authors': authors,
                        'title': article.medlinecitation.article.articletitle,
                        'journal': article.medlinecitation.article.journal.title,
                        'displayDate': formattedDate
                    }
                    PublicationsReciter.push(Publication)
                }

                
            }
        })
    }
    return PublicationsReciter
}
