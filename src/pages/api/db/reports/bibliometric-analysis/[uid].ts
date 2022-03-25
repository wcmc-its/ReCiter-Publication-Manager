import fs from 'fs';
import type { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import { reciterConfig } from '../../../../../../config/local';
import { generateBibliometricAnalysis } from "../../../../../../controllers/db/reports/bibliometric.controller";

export default async function handler(req: NextApiRequest,
    res: NextApiResponse<Buffer | string>) {
    if (req.method === "GET") {
        if(req.headers.authorization !== undefined && req.headers.authorization === reciterConfig.backendApiKey) {
            const { uid } = req.query;
            const bibliometricAnalysis: any = await generateBibliometricAnalysis(req, res, uid)
            //Creating the temporary file
            try{
                fs.writeFileSync(path.resolve('.', 'temp/' + uid + '.rtf'), bibliometricAnalysis)
                console.log('Creating the temporary file for bibliometricAnalysis for ' + uid)
            } catch(err) {
                console.log('Error creating file for bibliometricAnalysis for ' + uid + ': ' + err)
            }
            //Reading the temporary file
            try{
                console.log('Reading the temporary file for bibliometricAnalysis for ' + uid)
                const fileBuffer = fs.readFileSync(path.resolve('.', 'temp/' + uid + '.rtf'))
                res.setHeader('Content-Type', 'application/rtf')
                res.setHeader('Content-Disposition', 'attachment; filename=' + uid + '.rtf');
                console.log('Deleting the temporary file for bibliometricAnalysis for ' + uid)
                //Delete the temporary file
                fs.unlinkSync(path.resolve('.', 'temp/' + uid + '.rtf'))
                res.status(200).send(fileBuffer)
            } catch(err) {
                console.log('Error with the file for bibliometricAnalysis for ' + uid + ': ' + err)
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