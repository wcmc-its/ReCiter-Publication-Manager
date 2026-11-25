import type { NextApiRequest, NextApiResponse } from 'next';
import { reciterConfig } from '../../../../../../../config/local';
import {
    BibliometricExportError,
    bibliometricAvailability,
} from '../../../../../../../controllers/db/reports/bibliometric.docx.controller';

// GET -> { show, works, name }: whether this person can have a bibliometric analysis (5h). show is
// true for anyone with a counted work.
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
    try {
        res.status(200).json(await bibliometricAvailability(req.query.uid));
    } catch (e) {
        if (e instanceof BibliometricExportError) {
            res.status(e.status).json({ error: e.message });
            return;
        }
        console.log('[bibliometric] availability failed', (e as Error)?.message);
        res.status(500).json({ error: 'Unable to check the bibliometric analysis.' });
    }
}
