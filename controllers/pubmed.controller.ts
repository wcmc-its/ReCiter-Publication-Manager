import { reciterConfig } from '../config/local'
import { NextApiRequest } from 'next'
import dayjs from 'dayjs'
import {getPublications} from './featuregenerator.controller';

// Hardening follow-up to the 2026-09-01 stuck-spinner incident — neither upstream fetch
// carried a timeout, so a hung PubMed tool (e.g. an NCBI connection reset with no upstream
// retry) left the request open until the client's own 300s race fired, and a rejected fetch
// (a TypeError has no .status) came back here as statusCode: undefined with no logging at
// all. Bound both hops and always return a numeric statusCode + a { status, message } body.
const COUNT_FETCH_TIMEOUT_MS = 30_000
const SEARCH_FETCH_TIMEOUT_MS = 240_000

function isTimeoutError(error: any): boolean {
    return !!error && (error.name === 'TimeoutError' || error.name === 'AbortError')
}

function logPubmedFailure(hop: string, req: NextApiRequest, detail: string) {
    const strategyQuery = req.body && req.body['strategy-query']
    const personIdentifier = req.body && req.body.personIdentifier
    console.error(`[search/pubmed] ${hop} failed for query="${strategyQuery}" person=${personIdentifier}: ${detail}`)
}

export async function searchPubmed(req: NextApiRequest)  {
   return fetch(`${reciterConfig.reciterPubmed.searchPubmedCountEndpoint}`, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'reciter-pub-manager-server'
        },
        body: JSON.stringify(req.body),
        signal: AbortSignal.timeout(COUNT_FETCH_TIMEOUT_MS)
    })
        .then(async(res)=> {
            if(res.status !== 200) {
                let responseText: any
                try {
                    responseText = await res.json()
                } catch (parseError) {
                    responseText = { status: 500, message: `PubMed count request failed with HTTP ${res.status}` }
                }
                logPubmedFailure('count', req, `HTTP ${res.status}`)
                return {
                    statusCode: res.status,
                    statusText: responseText
                }
            } else {
                let data: any = await res.json()
                  if(parseInt(data, 10) <= 1000) {
                    return fetch(`${reciterConfig.reciterPubmed.searchPubmedEndpoint}`, {
                        method: "POST",
                        headers: {
                            'Content-Type': 'application/json',
                            'User-Agent': 'reciter-pub-manager-server'
                        },
                        body: JSON.stringify(req.body),
                        signal: AbortSignal.timeout(SEARCH_FETCH_TIMEOUT_MS)
                    })
                    .then(async (res) => {
                        let data: any = await res.json()
                        let featureGeneratorData = await getPublications(req.body.personIdentifier,req);
                         let first100PubData = retrieveFirstNew100PubMedArticles(data,featureGeneratorData)
                        return {
                            statusCode: res.status,
                            statusText: formatPubmedSearch(first100PubData, (data && data.length > 100?true : false))
                        }
                     })
                     .catch((error) => {
                         if (isTimeoutError(error)) {
                             const message = `PubMed search timed out after ${SEARCH_FETCH_TIMEOUT_MS / 1000} s`
                             logPubmedFailure('search', req, message)
                             return {
                                statusCode: 504,
                                statusText: { status: 504, message }
                             }
                         }
                         const message = `PubMed service unavailable: ${error.message}`
                         logPubmedFailure('search', req, message)
                         return {
                            statusCode: 502,
                            statusText: { status: 502, message }
                        }
                     });
                }
                else if(parseInt(data, 10) == 0)
                {
                    const message:string = "No results were found."
                    const limitExceededError = {
                        limit: 0,
                        message: message,
                        status: 500
                    }
                    return {
                        statusCode: res.status,
                        statusText: limitExceededError
                    }
                } 
                else {
                  
                    // const message:string = "Your search exceeded 2000 results: " + parseInt(data, 10) + ". Please narrow down search."
                    // const message:string = "Your search returned more than 1000 results. "+parseInt(data,10) + "Please refine."
                    const message:string = "Error: your search returned more than 1,000 results. Please refine your search so it returns fewer results"
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
            if (isTimeoutError(error)) {
                const message = `PubMed search timed out after ${COUNT_FETCH_TIMEOUT_MS / 1000} s`
                logPubmedFailure('count', req, message)
                return {
                    statusCode: 504,
                    statusText: { status: 504, message }
                }
            }
            const message = `PubMed service unavailable: ${error.message}`
            logPubmedFailure('count', req, message)
            return {
                statusCode: 502,
                statusText: { status: 502, message }
            }
        });
}
function retrieveFirstNew100PubMedArticles(pubMedData: any , featureGeneratorData: any)
{
        
      let finalPubMedArtickes={}; 
      let filterPubMedArticles = []; 
      let filter100PubMedArticles = [];
      let accpetedPubMedCount =0;
      let rejectedPubMedCount =0;
     
    if(pubMedData && featureGeneratorData && featureGeneratorData.statusText && featureGeneratorData.statusText.reciterData && featureGeneratorData.statusText.reciterData.reCiterArticleFeatures 
        && featureGeneratorData.statusText.reciterData.reCiterArticleFeatures.length > 0)
    {   
         for(let pubMedPMIDIndex=0; pubMedPMIDIndex < pubMedData.length ; pubMedPMIDIndex++) 
        //for(let fgPmidIndex =0; fgPmidIndex < featureGeneratorData.statusText.reciterData.reCiterArticleFeatures.length; fgPmidIndex++ )     
        {
            let pmidFound =false;
            let pubMedPmid = pubMedData[pubMedPMIDIndex].medlinecitation.medlinecitationpmid.pmid;
           // let  fgPmid = featureGeneratorData.statusText.reciterData.reCiterArticleFeatures[fgPmidIndex].pmid ;
            
            for(let fgPmidIndex =0; fgPmidIndex < featureGeneratorData.statusText.reciterData.reCiterArticleFeatures.length; fgPmidIndex++ )    
             // for(let pubMedPMIDIndex=0; pubMedPMIDIndex < pubMedData.length ; pubMedPMIDIndex++)  
              {
                if(featureGeneratorData.statusText.reciterData.reCiterArticleFeatures[fgPmidIndex].pmid== pubMedPmid
                    &&(featureGeneratorData.statusText.reciterData.reCiterArticleFeatures[fgPmidIndex].userAssertion ==='ACCEPTED' ||
                    featureGeneratorData.statusText.reciterData.reCiterArticleFeatures[fgPmidIndex].userAssertion ==='REJECTED')
                    )
                {
                    pmidFound = true;
                    if(featureGeneratorData.statusText.reciterData.reCiterArticleFeatures[fgPmidIndex].userAssertion ==='ACCEPTED')
                    {
                        accpetedPubMedCount++;
                    }
                    else if(featureGeneratorData.statusText.reciterData.reCiterArticleFeatures[fgPmidIndex].userAssertion ==='REJECTED')
                    {
                        rejectedPubMedCount++;
                    }
                    break;
                }
            }
            if(!pmidFound)
            {
                filterPubMedArticles.push(pubMedData[pubMedPMIDIndex]);
            }

        }
      
    }
      // No Accepted and Rejected publications then pickup all publications coming from pubmed
      if(featureGeneratorData && featureGeneratorData.statusText && featureGeneratorData.statusText.reciterData && !featureGeneratorData.statusText.reciterData.reCiterArticleFeatures)
      {
          filterPubMedArticles = pubMedData;
      }
      //pickup 100 records from the filterPubMedArticles
      filter100PubMedArticles = filterPubMedArticles.slice(0,100);
      finalPubMedArtickes = {"filter100PubMedArticles":filter100PubMedArticles,
                              'acceptedPubMedCount':accpetedPubMedCount,
                              'rejectedPubMedCount':rejectedPubMedCount};
      return finalPubMedArtickes;

}

function formatPubmedSearch(data: any,greaterThan100 : boolean) {
    const PublicationsReciter: any[] = []
    
    if(data.filter100PubMedArticles !== undefined) {
        data.filter100PubMedArticles.forEach((article: any) => {
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
                        'displayDate': formattedDate,
                        'greaterThan100': greaterThan100
                    }
                    PublicationsReciter.push(Publication)
                }
            }
        })
       
        PublicationsReciter.push({'acceptedPubMedCount': data.acceptedPubMedCount});
        PublicationsReciter.push({'rejectedPubMedCount': data.rejectedPubMedCount});

    }
    return PublicationsReciter
}
