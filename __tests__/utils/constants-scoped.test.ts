/**
 * Tests for Curator_Scoped role in the capability model.
 * Verifies that getCapabilities() correctly handles Curator_Scoped
 * without breaking existing role behavior.
 */

jest.mock('react-toastify', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}))

import {
  getCapabilities,
  getLandingPage,
  ROLE_CAPABILITIES,
  allowedPermissions,
} from '../../src/utils/constants'

describe('Curator_Scoped in allowedPermissions', () => {
  it('should have Curator_Scoped registered', () => {
    expect(allowedPermissions.Curator_Scoped).toBe('Curator_Scoped')
  })
})

describe('ROLE_CAPABILITIES', () => {
  it('should have Curator_Scoped entry with canCurate.scoped = true', () => {
    const scopedCaps = ROLE_CAPABILITIES[allowedPermissions.Curator_Scoped]
    expect(scopedCaps).toBeDefined()
    expect(scopedCaps.canCurate).toEqual({ scoped: true })
    expect(scopedCaps.canSearch).toBe(true)
    expect(scopedCaps.canReport).toBe(false)
    expect(scopedCaps.canManageUsers).toBe(false)
    expect(scopedCaps.canConfigure).toBe(false)
  })
})

describe('getCapabilities with Curator_Scoped', () => {
  it('should return canCurate.scoped = true for Curator_Scoped role', () => {
    const caps = getCapabilities([
      { roleLabel: 'Curator_Scoped', personIdentifier: 'abc123' },
    ])
    expect(caps.canCurate.scoped).toBe(true)
    expect(caps.canCurate.all).toBe(false)
    expect(caps.canCurate.self).toBe(false)
  })

  it('should merge Curator_Scoped + Reporter_All correctly', () => {
    const caps = getCapabilities([
      { roleLabel: 'Curator_Scoped', personIdentifier: 'abc123' },
      { roleLabel: 'Reporter_All', personIdentifier: 'abc123' },
    ])
    expect(caps.canCurate.scoped).toBe(true)
    expect(caps.canReport).toBe(true)
  })

  it('should merge Curator_Scoped + Curator_Self correctly', () => {
    const caps = getCapabilities([
      { roleLabel: 'Curator_Scoped', personIdentifier: 'abc123' },
      { roleLabel: 'Curator_Self', personIdentifier: 'abc123' },
    ])
    expect(caps.canCurate.scoped).toBe(true)
    expect(caps.canCurate.self).toBe(true)
  })

  it('should not set scoped for Curator_All (unchanged behavior)', () => {
    const caps = getCapabilities([
      { roleLabel: 'Curator_All', personIdentifier: 'abc123' },
    ])
    expect(caps.canCurate.all).toBe(true)
    expect(caps.canCurate.scoped).toBe(false)
  })

  it('should return scoped = false when no roles', () => {
    const caps = getCapabilities([])
    expect(caps.canCurate.scoped).toBe(false)
  })

  it('should include scopeData = null in baseline', () => {
    const caps = getCapabilities([])
    expect(caps.canCurate.scopeData).toBeNull()
  })

  it('should initialize proxyPersonIds as empty array in canCurate', () => {
    const caps = getCapabilities([])
    expect(caps.canCurate.proxyPersonIds).toEqual([])
  })

  it('should initialize proxyPersonIds as empty array for Curator_Scoped', () => {
    const caps = getCapabilities([{ roleLabel: 'Curator_Scoped' }])
    expect(caps.canCurate.proxyPersonIds).toEqual([])
  })
})

describe('getLandingPage with Curator_Scoped', () => {
  it('should return /search for Curator_Scoped (scoped, not all, not self)', () => {
    const caps = getCapabilities([
      { roleLabel: 'Curator_Scoped', personIdentifier: 'abc123' },
    ])
    const landing = getLandingPage(caps)
    expect(landing).toBe('/search')
  })
})

describe('Existing role behavior unchanged', () => {
  it('should still return correct caps for Superuser', () => {
    const caps = getCapabilities([
      { roleLabel: 'Superuser', personIdentifier: 'su1' },
    ])
    expect(caps.canCurate.all).toBe(true)
    expect(caps.canManageUsers).toBe(true)
    expect(caps.canConfigure).toBe(true)
  })

  it('should still return correct caps for Curator_Self', () => {
    const caps = getCapabilities([
      { roleLabel: 'Curator_Self', personIdentifier: 'cs1' },
    ])
    expect(caps.canCurate.self).toBe(true)
    expect(caps.canCurate.all).toBe(false)
    expect(caps.canCurate.personIdentifier).toBe('cs1')
  })

  it('should still return correct landing for Curator_Self', () => {
    const caps = getCapabilities([
      { roleLabel: 'Curator_Self', personIdentifier: 'cs1' },
    ])
    expect(getLandingPage(caps)).toBe('/curate/cs1')
  })
})
