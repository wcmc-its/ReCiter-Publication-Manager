import type { NextApiRequest, NextApiResponse } from 'next';
import { reciterConfig } from '../../../../../../config/local';
import { generateBibliometricAnalysis } from "../../../../../../controllers/db/reports/bibliometric.controller";

export default async function handler(req: NextApiRequest,
    res: NextApiResponse<Buffer | string>) {
    if (req.method === "GET") {
        if(req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
            const { uid } = req.query;
            const bibliometricAnalysis: any = await generateBibliometricAnalysis(req, res, uid)
            try{
                const fileBuffer = Buffer.from(bibliometricAnalysis, 'utf-8')
                res.setHeader('Content-Type', 'application/rtf')
                res.setHeader('Content-Disposition', 'attachment; filename=' + uid + '.rtf');
                console.log('Creating the file buffer for bibliometricAnalysis for ' + uid)
                res.status(200).send(fileBuffer)
            } catch(err) {
                console.log('Error with the file for bibliometricAnalysis for ' + uid + ': ' + err)
                res.status(500).send('Error with the file for bibliometricAnalysis for ' + uid + ': ' + err)
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