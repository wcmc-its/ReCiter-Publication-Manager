// Mock the sequelize instance BEFORE importing the controller
jest.mock('../src/db/db', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}))

// Use require after mock declaration to ensure mock is applied
const { findUserPermissionsEnriched } = require('../controllers/db/userroles.controller')

// Get the mock so we can configure it per test
const getMockQuery = () => {
  const db = require('../src/db/db')
  return db.default.query as jest.Mock
}

// Simulated permission rows by user identity
const permissionsByUser: Record<string, Array<{ permissionKey: string }>> = {
  'su001|super@test.com': [
    { permissionKey: 'canCurate' },
    { permissionKey: 'canSearch' },
    { permissionKey: 'canReport' },
    { permissionKey: 'canManageUsers' },
    { permissionKey: 'canConfigure' },
    { permissionKey: 'canManageNotifications' },
    { permissionKey: 'canManageProfile' },
  ],
  'cs001|curator_self@test.com': [
    { permissionKey: 'canCurate' },
    { permissionKey: 'canManageNotifications' },
    { permissionKey: 'canManageProfile' },
  ],
  'ra001|reporter@test.com': [
    { permissionKey: 'canReport' },
    { permissionKey: 'canSearch' },
    { permissionKey: 'canManageProfile' },
  ],
  'ca001|curator_all@test.com': [
    { permissionKey: 'canCurate' },
    { permissionKey: 'canSearch' },
    { permissionKey: 'canManageNotifications' },
    { permissionKey: 'canManageProfile' },
  ],
  'none|noroles@test.com': [],
}

// Simulated resource rows
const resourceRows = [
  {
    resourceType: 'nav',
    resourceKey: 'nav_search',
    displayOrder: 1,
    icon: 'Search',
    label: 'Find People',
    route: '/search',
    permissionKey: 'canSearch',
  },
  {
    resourceType: 'nav',
    resourceKey: 'nav_curate',
    displayOrder: 2,
    icon: 'LocalLibrary',
    label: 'Curate Publications',
    route: '/curate',
    permissionKey: 'canCurate',
  },
  {
    resourceType: 'nav',
    resourceKey: 'nav_report',
    displayOrder: 3,
    icon: 'Assessment',
    label: 'Create Reports',
    route: '/report',
    permissionKey: 'canReport',
  },
  {
    resourceType: 'nav',
    resourceKey: 'nav_notifications',
    displayOrder: 4,
    icon: 'NotificationsActive',
    label: 'Manage Notifications',
    route: '/notifications',
    permissionKey: 'canManageNotifications',
  },
  {
    resourceType: 'nav',
    resourceKey: 'nav_profile',
    displayOrder: 5,
    icon: 'AccountCircle',
    label: 'Manage Profile',
    route: '/manageprofile',
    permissionKey: 'canManageProfile',
  },
  {
    resourceType: 'nav',
    resourceKey: 'nav_users',
    displayOrder: 6,
    icon: 'Group',
    label: 'Manage Users',
    route: '/manageusers',
    permissionKey: 'canManageUsers',
  },
  {
    resourceType: 'nav',
    resourceKey: 'nav_config',
    displayOrder: 7,
    icon: 'Settings',
    label: 'Configuration',
    route: '/configuration',
    permissionKey: 'canConfigure',
  },
]

describe('findUserPermissionsEnriched', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  function setupMockQuery() {
    const mockQuery = getMockQuery()
    mockQuery.mockImplementation((sql: string, opts: any) => {
      const replacements = opts?.replacements || {}

      // Permissions query (contains admin_permissions but NOT admin_permission_resources)
      if (sql.includes('admin_permissions') && !sql.includes('admin_permission_resources')) {
        const key = `${replacements.personIdentifier}|${replacements.email}`
        const rows = permissionsByUser[key] || []
        return Promise.resolve(rows)
      }

      // Resources query (contains admin_permission_resources)
      if (sql.includes('admin_permission_resources')) {
        const permKeys: string[] = replacements.permKeys || []
        const filtered = resourceRows.filter((r) =>
          permKeys.includes(r.permissionKey)
        )
        return Promise.resolve(filtered)
      }

      return Promise.resolve([])
    })
  }

  it('Test 1: returns all 7 permission keys for a Superuser', async () => {
    setupMockQuery()
    const result = await findUserPermissionsEnriched(
      ['email', 'personIdentifier'],
      ['super@test.com', 'su001']
    )
    expect(result.permissions).toEqual(
      expect.arrayContaining([
        'canCurate',
        'canSearch',
        'canReport',
        'canManageUsers',
        'canConfigure',
        'canManageNotifications',
        'canManageProfile',
      ])
    )
    expect(result.permissions).toHaveLength(7)
  })

  it('Test 2: returns correct permission keys for Curator_Self', async () => {
    setupMockQuery()
    const result = await findUserPermissionsEnriched(
      ['email', 'personIdentifier'],
      ['curator_self@test.com', 'cs001']
    )
    expect(result.permissions).toEqual(
      expect.arrayContaining([
        'canCurate',
        'canManageNotifications',
        'canManageProfile',
      ])
    )
    expect(result.permissions).toHaveLength(3)
  })

  it('Test 3: returns correct permission keys for Reporter_All', async () => {
    setupMockQuery()
    const result = await findUserPermissionsEnriched(
      ['email', 'personIdentifier'],
      ['reporter@test.com', 'ra001']
    )
    expect(result.permissions).toEqual(
      expect.arrayContaining(['canReport', 'canSearch', 'canManageProfile'])
    )
    expect(result.permissions).toHaveLength(3)
  })

  it('Test 4: returns correct permission keys for Curator_All', async () => {
    setupMockQuery()
    const result = await findUserPermissionsEnriched(
      ['email', 'personIdentifier'],
      ['curator_all@test.com', 'ca001']
    )
    expect(result.permissions).toEqual(
      expect.arrayContaining([
        'canCurate',
        'canSearch',
        'canManageNotifications',
        'canManageProfile',
      ])
    )
    expect(result.permissions).toHaveLength(4)
  })

  it('Test 5: returns empty permissions array when user has no roles', async () => {
    setupMockQuery()
    const result = await findUserPermissionsEnriched(
      ['email', 'personIdentifier'],
      ['noroles@test.com', 'none']
    )
    expect(result.permissions).toEqual([])
  })

  it('Test 6: returns permissionResources with expected fields', async () => {
    setupMockQuery()
    const result = await findUserPermissionsEnriched(
      ['email', 'personIdentifier'],
      ['super@test.com', 'su001']
    )
    expect(result.permissionResources.length).toBeGreaterThan(0)
    const resource = result.permissionResources[0]
    expect(resource).toHaveProperty('resourceType')
    expect(resource).toHaveProperty('resourceKey')
    expect(resource).toHaveProperty('displayOrder')
    expect(resource).toHaveProperty('icon')
    expect(resource).toHaveProperty('label')
    expect(resource).toHaveProperty('route')
    expect(resource).toHaveProperty('permissionKey')
  })

  it('Test 7: returns empty permissionResources when permissions array is empty', async () => {
    setupMockQuery()
    const result = await findUserPermissionsEnriched(
      ['email', 'personIdentifier'],
      ['noroles@test.com', 'none']
    )
    expect(result.permissionResources).toEqual([])
  })

  it('Test 8: throws when attrTypes is not an array', async () => {
    await expect(
      findUserPermissionsEnriched('email' as any, ['test@test.com'])
    ).rejects.toThrow('Both attrTypes and attrValues must be arrays')
  })

  it('Test 9: throws when attrTypes and attrValues have different lengths', async () => {
    await expect(
      findUserPermissionsEnriched(['email', 'personIdentifier'], ['test@test.com'])
    ).rejects.toThrow('attrTypes and attrValues must be the same length')
  })

  it('Test 10: permissionResources are ordered by displayOrder ASC', async () => {
    setupMockQuery()
    const result = await findUserPermissionsEnriched(
      ['email', 'personIdentifier'],
      ['super@test.com', 'su001']
    )
    const orders = result.permissionResources.map(
      (r: any) => r.displayOrder
    )
    const sorted = [...orders].sort((a: number, b: number) => a - b)
    expect(orders).toEqual(sorted)
  })
})
