import {
  hasPermission,
  getPermissionsFromRaw,
  getLandingPageFromPermissions,
} from '../src/utils/permissionUtils'

describe('hasPermission', () => {
  it('returns true when permission key exists in array', () => {
    expect(hasPermission(['canCurate', 'canSearch'], 'canCurate')).toBe(true)
  })

  it('returns false when permission key is not in array', () => {
    expect(hasPermission(['canCurate'], 'canSearch')).toBe(false)
  })

  it('returns false for empty permissions array', () => {
    expect(hasPermission([], 'canCurate')).toBe(false)
  })

  it('returns false for null permissions (defensive)', () => {
    expect(hasPermission(null as any, 'canCurate')).toBe(false)
  })

  it('returns false for undefined permissions (defensive)', () => {
    expect(hasPermission(undefined as any, 'canCurate')).toBe(false)
  })
})

describe('getPermissionsFromRaw', () => {
  it('parses valid JSON array string', () => {
    expect(getPermissionsFromRaw('["canCurate","canSearch"]')).toEqual([
      'canCurate',
      'canSearch',
    ])
  })

  it('returns empty array for empty string', () => {
    expect(getPermissionsFromRaw('')).toEqual([])
  })

  it('returns empty array for null input', () => {
    expect(getPermissionsFromRaw(null as any)).toEqual([])
  })

  it('returns empty array for undefined input', () => {
    expect(getPermissionsFromRaw(undefined as any)).toEqual([])
  })

  it('returns empty array for invalid JSON string', () => {
    expect(getPermissionsFromRaw('not-json')).toEqual([])
  })

  it('returns empty array for JSON string of non-array value', () => {
    expect(getPermissionsFromRaw('"just-a-string"')).toEqual([])
  })
})

describe('getLandingPageFromPermissions', () => {
  it('returns /search for Superuser', () => {
    const perms = [
      'canCurate',
      'canSearch',
      'canReport',
      'canManageUsers',
      'canConfigure',
      'canManageNotifications',
      'canManageProfile',
    ]
    const roles = [{ roleLabel: 'Superuser', personIdentifier: 'paa2013' }]
    expect(getLandingPageFromPermissions(perms, roles)).toBe('/search')
  })

  it('returns /curate/:id for Curator_Self', () => {
    const perms = ['canCurate']
    const roles = [
      { roleLabel: 'Curator_Self', personIdentifier: 'paa2013' },
    ]
    expect(getLandingPageFromPermissions(perms, roles)).toBe('/curate/paa2013')
  })

  it('returns /search for Curator_All', () => {
    const perms = ['canCurate', 'canSearch']
    const roles = [
      { roleLabel: 'Curator_All', personIdentifier: 'paa2013' },
    ]
    expect(getLandingPageFromPermissions(perms, roles)).toBe('/search')
  })

  it('returns /search for Reporter_All', () => {
    const perms = ['canReport', 'canSearch']
    const roles = [
      { roleLabel: 'Reporter_All', personIdentifier: 'paa2013' },
    ]
    expect(getLandingPageFromPermissions(perms, roles)).toBe('/search')
  })

  it('returns /curate/:id for Curator_Self + Reporter_All (self takes priority)', () => {
    const perms = ['canCurate', 'canReport', 'canSearch']
    const roles = [
      { roleLabel: 'Curator_Self', personIdentifier: 'paa2013' },
      { roleLabel: 'Reporter_All', personIdentifier: 'paa2013' },
    ]
    expect(getLandingPageFromPermissions(perms, roles)).toBe('/curate/paa2013')
  })

  it('returns /search for Curator_Scoped', () => {
    const perms = ['canCurate', 'canSearch']
    const roles = [
      { roleLabel: 'Curator_Scoped', personIdentifier: 'paa2013' },
    ]
    expect(getLandingPageFromPermissions(perms, roles)).toBe('/search')
  })

  it('returns /noaccess for truly empty permissions and roles', () => {
    expect(getLandingPageFromPermissions([], [])).toBe('/noaccess')
  })

  it('returns /search when baseline permissions are present with no roles', () => {
    const perms = ['canSearch', 'canReport']
    expect(getLandingPageFromPermissions(perms, [])).toBe('/search')
  })
})

describe('Permission models (smoke test)', () => {
  it('AdminPermission exports class with static initModel', () => {
    const { AdminPermission } = require('../src/db/models/AdminPermission')
    expect(typeof AdminPermission).toBe('function')
    expect(typeof AdminPermission.initModel).toBe('function')
  })

  it('AdminRolePermission exports class with static initModel', () => {
    const { AdminRolePermission } = require('../src/db/models/AdminRolePermission')
    expect(typeof AdminRolePermission).toBe('function')
    expect(typeof AdminRolePermission.initModel).toBe('function')
  })

  it('AdminPermissionResource exports class with static initModel', () => {
    const { AdminPermissionResource } = require('../src/db/models/AdminPermissionResource')
    expect(typeof AdminPermissionResource).toBe('function')
    expect(typeof AdminPermissionResource.initModel).toBe('function')
  })
})
