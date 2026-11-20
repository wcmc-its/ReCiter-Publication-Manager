import type { NextApiRequest, NextApiResponse } from 'next';
import { reciterConfig } from '../../../../../../../config/local';
import {
    BibliometricExportError,
    bibliometricAvailability,
    bibliometricReportVersion,
} from '../../../../../../../controllers/db/reports/bibliometric.docx.controller';

// GET -> which bibliometric report the Profile drawer offers for this person (5h P5).
//   flag "rtf" or missing: { version: "rtf" } and nothing else; the drawer then asks the v1
//     show-button route exactly as before.
//   flag "docx": { version: "docx", show, works, name }; show is true for anyone with a counted work.
// Same auth as POST /api/db/reports/bibliometric: the backend API key here, and /api/db/** is
// session-gated by src/middleware.ts.
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
    const version = await bibliometricReportVersion();
    if (version !== 'docx') {
        res.status(200).json({ version });
        return;
    }
    try {
        res.status(200).json({ version, ...(await bibliometricAvailability(req.query.uid)) });
    } catch (e) {
        if (e instanceof BibliometricExportError) {
            res.status(e.status).json({ error: e.message });
            return;
        }
        console.log('[bibliometric] availability failed', (e as Error)?.message);
        res.status(500).json({ error: 'Unable to check the bibliometric analysis.' });
    }
}
