import type { NextApiRequest, NextApiResponse } from 'next'
import { reciterConfig } from '../../../../../../../config/local'
import { articleTypeFilter } from '../../../../../../../controllers/db/reports/filter.controller'
import { AnalysisSummaryArticle } from '../../../../../../db/models/AnalysisSummaryArticle'

export default async function handler(req: NextApiRequest,
    res: NextApiResponse<AnalysisSummaryArticle | string>) {
    if (req.method === "GET") {
        if(req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
            await articleTypeFilter(req, res)
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