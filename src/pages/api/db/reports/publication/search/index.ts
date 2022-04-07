import type { NextApiRequest, NextApiResponse } from 'next';
import { reciterConfig } from '../../../../../../../config/local';
import { publicationSearchWithFilter } from '../../../../../../../controllers/db/reports/publication.report.search.controller';
import { PublicationSearchFilter } from '../../../../../../../types/publication.report.search';

export default async function handler(req: NextApiRequest,
    res: NextApiResponse<Buffer | string>) {
    if (req.method === "GET") {
        if(req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
            const apiBody: PublicationSearchFilter = req.body;
            try{
                const searchOutput: any = await publicationSearchWithFilter(req, res)
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
         res.status(400).send('HTTP Method supported is GET')
    }
}