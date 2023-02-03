import type { NextApiRequest, NextApiResponse } from 'next';
import { reciterConfig } from '../../../../../../config/local';
import { generatePubsRtf } from '../../../../../../controllers/db/reports/publication.report.controller';
import { GeneratePubsApiBody } from '../../../../../../types/publication.report.body';

export default async function handler(req: NextApiRequest,
    res: NextApiResponse<Buffer | string>) {
    if (req.method === "POST") {
        if(req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
            const apiBody: GeneratePubsApiBody = req.body;
            console.log('apiBody for RTF**********************',apiBody);
            const generatePubsRtfOutput: any = await generatePubsRtf(req, res)
            try{
                console.log('coming into this to export from here*********************************',generatePubsRtfOutput);
                if(generatePubsRtfOutput)
                {
                    const fileBuffer = Buffer.from(generatePubsRtfOutput, 'utf-8')
                    res.setHeader('Content-Type', 'application/rtf')
                    res.setHeader('Content-Disposition', 'attachment; filename=' + apiBody.personIdentifiers + '.rtf');
                    console.log('Creating the file buffer for generatePubsRtf with params: ' + apiBody)
                    res.status(200).send(fileBuffer)
                }
                else
                {
                    /**TO DO 
                     * May be displaying toater would help end user instead of a showing an error message in the file.
                    */

                }
            } catch(err) {
                console.log('Error with the file for generatePubsRtf for ' + apiBody + ': ' + err)
                res.status(500).send('Error with the file for generatePubsRtf for ' + apiBody + ': ' + err)
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