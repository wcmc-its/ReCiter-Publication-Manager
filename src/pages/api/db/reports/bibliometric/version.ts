import type { NextApiRequest, NextApiResponse } from 'next';
import { reciterConfig } from '../../../../../../config/local';
import { bibliometricReportVersion } from '../../../../../../controllers/db/reports/bibliometric.docx.controller';

// GET -> { version: "rtf" | "docx" }, the admin_settings bibliometricReport flag (5h P5). Reports
// shows its "Bibliometric analysis" button only for "docx". Same auth as its neighbours.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.status(400).send('HTTP Method supported is GET');
        return;
    }
    if (req.headers.authorization === undefined) {
        res.status(400).send('Authorization header is needed');
        return;
    }
    if (req.headers.authorization !== reciterConfig.backendApiKey) {
        res.status(401).send('Authorization header is incorrect');
        return;
    }
    res.status(200).json({ version: await bibliometricReportVersion() });
}
