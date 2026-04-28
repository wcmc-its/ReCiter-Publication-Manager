import type { NextApiRequest, NextApiResponse } from 'next';
import { reciterConfig } from '../../../../../../../../config/local';
import { publicationAuthorSearchWithFilter } from '../../../../../../../../controllers/db/reports/publication.report.search.controller';
import { PublicationAuthorSearchFilter } from '../../../../../../../../types/publication.report.search';
import { PersonArticleAuthor } from '../../../../../../../db/models/PersonArticleAuthor';

export default async function handler(req: NextApiRequest,
    res: NextApiResponse<PersonArticleAuthor | string>) {
    if (req.method === "POST") {
        if(req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
            const apiBody: PublicationAuthorSearchFilter = req.body;
            try{
                const searchOutput: any = await publicationAuthorSearchWithFilter(req, res)
                res.status(200).send(searchOutput)
            } catch(err) {
                console.log('Error with the search filter ' + JSON.stringify(apiBody) + ': ' + err)
                res.status(500).send('Error with the search filter ' + JSON.stringify(apiBody) + ': ' + err)
            }
        } else if(req.headers.authorization === undefined) {
            res.status(400).send("Authorization header is needed")
        } else {
            res.status(401).send("Authorization header is incorrect")
        }
    } else {
         // Default this to a bad request for now
         res.status(400).send('HTTP Method supported is POST')
    }
}