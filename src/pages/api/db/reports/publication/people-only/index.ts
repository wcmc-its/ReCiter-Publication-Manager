import type { NextApiRequest, NextApiResponse } from 'next';
import { reciterConfig } from '../../../../../../../config/local';
import { generatePubsPeopleOnlyRtf } from '../../../../../../../controllers/db/reports/publication.report.controller';
import { GeneratePubsPeopleOnlyApiBody } from '../../../../../../../types/publication.report.body';

export default async function handler(req: NextApiRequest,
    res: NextApiResponse<Buffer | string>) {
    if (req.method === "POST") {
        if(req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
            const apiBody: GeneratePubsPeopleOnlyApiBody = req.body;
            const generatePubsPeopleOnlyRtfOutput: any = await generatePubsPeopleOnlyRtf(req, res)
            try{
                const fileBuffer = Buffer.from(generatePubsPeopleOnlyRtfOutput, 'utf-8')
                res.setHeader('Content-Type', 'application/rtf')
                res.setHeader('Content-Disposition', 'attachment; filename=' + apiBody.personIdentifiers + '.rtf');
                res.status(200).send(fileBuffer)
            } catch(err) {
                console.log('Error with the file for generatePubsPeopleOnlyRtf for ' + apiBody.personIdentifiers + ': ' + err)
                res.status(500).send('Error with the file for generatePubsPeopleOnlyRtf for ' + apiBody.personIdentifiers + ': ' + err)
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