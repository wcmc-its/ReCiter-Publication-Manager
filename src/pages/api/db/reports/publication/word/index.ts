import type { NextApiRequest, NextApiResponse } from 'next';
import { reciterConfig } from '../../../../../../../config/local';
import { generateWordBibliography, WordExportError } from '../../../../../../../controllers/db/reports/word.report.controller';

// POST { filters, groupBy: 'year' | 'type' | 'person', includeExternal } -> .docx bibliography.
// Same auth as the other report exports (backend API key; /api/db/** is also session-gated).
export const config = { api: { bodyParser: { sizeLimit: '1mb' }, responseLimit: false } };

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
        const out = await generateWordBibliography(body);
        const date = new Date().toISOString().slice(0, 10);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="ArticleReport-ReCiter-${date}.docx"`);
        res.setHeader('X-Export-Entries', String(out.entries));
        res.setHeader('X-Export-Total', String(out.total));
        res.setHeader('X-Export-Limit', String(out.limit));
        res.status(200).send(out.buffer);
    } catch (e) {
        if (e instanceof WordExportError) {
            res.status(e.status).json({ error: e.message });
            return;
        }
        console.log('[word export] failed', e);
        res.status(500).json({ error: 'Unable to generate the Word export.' });
    }
}
