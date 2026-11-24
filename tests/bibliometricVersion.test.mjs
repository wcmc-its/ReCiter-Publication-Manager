// 5h P5: the admin_settings bibliometricReport flag. Only exactly "docx" switches to v2; anything
// else, including a missing row, keeps the v1 RTF.
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseBibliometricVersion } from '../controllers/db/reports/bibliometricVersion.ts'

test('a missing or empty row means rtf', () => {
  assert.equal(parseBibliometricVersion(null), 'rtf')
  assert.equal(parseBibliometricVersion(undefined), 'rtf')
  assert.equal(parseBibliometricVersion(''), 'rtf')
  assert.equal(parseBibliometricVersion('{}'), 'rtf')
})

test('docx in the stored JSON switches to v2', () => {
  assert.equal(parseBibliometricVersion('{"version":"docx"}'), 'docx')
  assert.equal(parseBibliometricVersion({ version: 'docx' }), 'docx')
  assert.equal(parseBibliometricVersion('[{"version":"docx"}]'), 'docx')
  assert.equal(parseBibliometricVersion(JSON.stringify('{"version":"docx"}')), 'docx')
  assert.equal(parseBibliometricVersion('{"version":" DOCX "}'), 'docx')
})

test('rtf, other values and bad JSON keep v1', () => {
  assert.equal(parseBibliometricVersion('{"version":"rtf"}'), 'rtf')
  assert.equal(parseBibliometricVersion('{"version":"v2"}'), 'rtf')
  assert.equal(parseBibliometricVersion('{"version":true}'), 'rtf')
  assert.equal(parseBibliometricVersion('{version:docx}'), 'rtf')
  assert.equal(parseBibliometricVersion('"docx"'), 'rtf')
})

test('the Configuration page hides the SQL-only flag row and nothing else', async () => {
  const { isHiddenSetting } = await import('../src/lib/adminSettingsDisplay.ts')
  assert.equal(isHiddenSetting({ viewName: 'bibliometricReport' }), true)
  for (const viewName of ['reportingArticleRTF', 'viewProfile', 'userRoles', undefined]) {
    assert.equal(isHiddenSetting({ viewName }), false)
  }
})
