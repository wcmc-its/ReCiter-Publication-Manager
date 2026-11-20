// 5h P5: the client reads the server's filename out of Content-Disposition.
import test from 'node:test'
import assert from 'node:assert/strict'
import { fileNameFromDisposition } from '../src/utils/bibliometricDownload.ts'

test('fileNameFromDisposition takes the quoted server filename', () => {
  assert.equal(
    fileNameFromDisposition('attachment; filename="BibliometricAnalysis-abc1234-2026-11-11.docx"', 'x.docx'),
    'BibliometricAnalysis-abc1234-2026-11-11.docx'
  )
  assert.equal(fileNameFromDisposition('attachment; filename=plain.docx', 'x.docx'), 'plain.docx')
})

test('fileNameFromDisposition falls back when the header is missing or has no filename', () => {
  assert.equal(fileNameFromDisposition(null, 'fallback.docx'), 'fallback.docx')
  assert.equal(fileNameFromDisposition('attachment', 'fallback.docx'), 'fallback.docx')
})
