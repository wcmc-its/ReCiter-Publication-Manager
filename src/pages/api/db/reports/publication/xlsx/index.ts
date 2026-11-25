import type { NextApiRequest, NextApiResponse } from 'next';
import { reciterConfig } from '../../../../../../../config/local';
import { ExportRequestError, planXlsxExport, streamXlsxExport } from '../../../../../../../controllers/db/reports/report.xlsx.controller';

// The workbook is streamed, so let it exceed Next's 4 MB response warning.
export const config = { api: { responseLimit: false } };

// POST { filters, sort } -> streamed .xlsx (Publications, Authorships, About). Same auth as the CSV
// export routes: the /api/db session gate in middleware plus the backend API key header.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
    let plan;
    try {
        plan = await planXlsxExport(req.body || {});
    } catch (err) {
        if (err instanceof ExportRequestError) {
            res.status(400).json({ error: err.message });
            return;
        }
        console.log('[xlsx export] count failed', err);
        res.status(500).json({ error: 'Unable to count the export rows.' });
        return;
    }
    const date = new Date().toISOString().slice(0, 10);
    try {
        await streamXlsxExport(plan, res, `PublicationReport-ReCiter-${date}.xlsx`);
        if (!res.writableEnded) res.end();
    } catch (err) {
        console.log('[xlsx export] stream failed', err);
        // Once bytes are out the status can't change; drop the connection so the client sees a failed download.
        if (res.headersSent) res.destroy(err as Error);
        else res.status(500).json({ error: 'Unable to generate the Excel file.' });
    }
}
