// Browser-side file delivery. The DOCUMENTS are built in controllers/literatureExport.ts, which is
// pure and therefore testable (npm run check:literature); this file only knows how to hand a blob
// to a browser.

import type { Block, Sheet } from '../../../../controllers/literatureExport'

function save(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
}

// A real .docx, not an RTF wearing Word's clothes. RTF was cheaper — Word opens it, and it cost no
// dependency — but the file still says .rtf, and a journal submission portal that rejects .rtf
// rejects the appendix, which is the one moment this feature exists for.
//
// Both imports are dynamic and both are inside the click: `docx` and the renderer that uses it are
// fetched the first time someone actually downloads a document, and cost the page nothing before
// that. Same bargain as exceljs below.
export async function saveDocx(blocks: Block[], filename: string) {
    const [{ docxDoc }, { Packer }] = await Promise.all([
        import('../../../../controllers/literatureDocx'),
        import('docx'),
    ])
    save(await Packer.toBlob(docxDoc(blocks)), filename)
}

export function saveText(text: string, filename: string) {
    save(new Blob([text], { type: 'text/plain;charset=utf-8' }), filename)
}

// exceljs is ALREADY a dependency (Create Reports uses it), but it is ~600KB — so it is imported
// dynamically, inside the click. The library is fetched the first time someone actually downloads a
// spreadsheet and costs the page nothing before that.
export async function saveXlsx(sheets: Sheet[], filename: string) {
    const Excel = (await import('exceljs')).default
    const wb = new Excel.Workbook()

    for (const sheet of sheets) {
        const ws = wb.addWorksheet(sheet.name)
        ws.addRow(sheet.head)
        sheet.rows.forEach(r => ws.addRow(r))

        // The formatting that makes a spreadsheet usable rather than merely correct: a bold header
        // that stays put while you scroll 50 records, and columns wide enough to read a title.
        ws.getRow(1).font = { bold: true }
        ws.views = [{ state: 'frozen', ySplit: 1 }]
        ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.head.length } }
        ws.columns.forEach((col, i) => {
            const longest = Math.max(
                sheet.head[i]?.length ?? 0,
                ...sheet.rows.map(r => String(r[i] ?? '').length),
            )
            col.width = Math.min(Math.max(longest + 2, 10), 60)   // a title is not a 400-char column
        })
    }

    const buf = await wb.xlsx.writeBuffer()
    save(
        new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        filename,
    )
}

// One run, one basename: the Word file and the spreadsheet from the same search sit next to each
// other in a downloads folder instead of being impossible to pair up a week later.
export function stamp(prefix: string, runDate: string): string {
    return `${prefix}-${runDate}`
}
