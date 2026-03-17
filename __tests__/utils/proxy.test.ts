/**
 * Tests for isProxyFor() -- proxy access resolution logic.
 * Verifies that proxy person ID matching works correctly for curation proxy assignments.
 */

import { isProxyFor } from '../../src/utils/scopeResolver'

describe('isProxyFor', () => {
  it('should return false when proxyPersonIds is null', () => {
    expect(isProxyFor(null, 'abc123')).toBe(false)
  })

  it('should return false when proxyPersonIds is empty array', () => {
    expect(isProxyFor([], 'abc123')).toBe(false)
  })

  it('should return true when personIdentifier is in proxyPersonIds', () => {
    expect(isProxyFor(['abc123', 'def456'], 'abc123')).toBe(true)
  })

  it('should return false when personIdentifier is not in proxyPersonIds', () => {
    expect(isProxyFor(['abc123', 'def456'], 'xyz789')).toBe(false)
  })

  it('should return true for single-element array with matching personIdentifier', () => {
    expect(isProxyFor(['abc123'], 'abc123')).toBe(true)
  })
})
