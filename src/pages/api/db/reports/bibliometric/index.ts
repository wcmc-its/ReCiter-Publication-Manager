import type { NextApiRequest, NextApiResponse } from 'next';
import { reciterConfig } from '../../../../../../config/local';
import { BibliometricExportError, generateBibliometricDocx } from '../../../../../../controllers/db/reports/bibliometric.docx.controller';

// POST { uid } -> BibliometricAnalysis-<uid>-<run date>.docx, the v2 report (5h P4). Same checks as
// the v1 RTF route (bibliometric-analysis/[uid].ts): the backend API key here, and /api/db/** is
// next-auth session-gated by src/middleware.ts. Nothing in the UI calls this route until P5.
// 503 "Bibliometric v2 data not available yet" while the ReCiterDB v3.11 columns or flags are absent.
export const config = { api: { bodyParser: { sizeLimit: '16kb' }, responseLimit: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse<Buffer | string | { error: string }>) {
    if (req.method !== 'POST') {
        res.status(400).send('HTTP Method supported is POST');
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
        const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        const out = await generateBibliometricDocx(body?.uid);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${out.fileName}"`);
        res.setHeader('X-Export-Works', String(out.counted));
        res.setHeader('X-Export-External', String(out.external));
        res.setHeader('X-Export-Peer', out.peerShown ? '1' : '0');
        res.status(200).send(out.buffer);
    } catch (e) {
        if (e instanceof BibliometricExportError) {
            res.status(e.status).json({ error: e.message });
            return;
        }
        if (e instanceof SyntaxError) {
            res.status(400).json({ error: 'The request body is not valid JSON.' });
            return;
        }
        console.log('[bibliometric v2] failed', e);
        res.status(500).json({ error: 'Unable to generate the bibliometric analysis.' });
    }
}
