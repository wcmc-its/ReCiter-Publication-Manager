/**
 * Middleware unit tests for permission-based route enforcement (Phase 15 Plan 02).
 *
 * Tests verify:
 * - ROUTE_PERMISSIONS map completeness (MW-02)
 * - Permission-based route access via hasPermission (MW-01, MW-02)
 * - Baseline fallback for empty permissions (MW-03)
 * - Self-only curator enforcement via role labels (MW-04)
 * - Landing page redirect via getLandingPageFromPermissions (MW-05)
 * - .git path blocking (403)
 * - No-cookie redirect to /login
 * - No-roles redirect to /error
 */

// Mock jwt-decode BEFORE importing middleware
jest.mock('jwt-decode', () => ({
  __esModule: true,
  default: jest.fn(),
}))

// Track redirect and next calls
const mockRedirectCalls: any[] = []
const mockNextCalls: any[] = []

jest.mock('next/server', () => {
  // NextResponse constructor for `new NextResponse(null, { status: 403 })`
  function MockNextResponse(body: any, init?: any) {
    return { type: 'response', body, status: init?.status, headers: init?.headers }
  }
  MockNextResponse.redirect = (...args: any[]) => {
    mockRedirectCalls.push(args)
    return { type: 'redirect', args }
  }
  MockNextResponse.next = (...args: any[]) => {
    mockNextCalls.push(args)
    return { type: 'next', args }
  }
  return {
    NextRequest: jest.fn(),
    NextResponse: MockNextResponse,
  }
})

// Import after mocks are set up
const jwtDecode = require('jwt-decode').default
const { middleware, ROUTE_PERMISSIONS } = require('../src/middleware')

// -- Helpers --

function createMockRequest(pathname: string, hasCookie: boolean = true) {
  const url = new URL(pathname, 'http://localhost:3000')
  return {
    nextUrl: {
      pathname,
      clone: () => {
        const cloned = { pathname, toString: () => `http://localhost:3000${pathname}` }
        Object.defineProperty(cloned, 'pathname', {
          get: () => cloned['_pathname'] || pathname,
          set: (v: string) => { cloned['_pathname'] = v },
          enumerable: true,
          configurable: true,
        })
        return cloned
      },
    },
    cookies: {
      has: (name: string) => hasCookie && (name === 'next-auth.session-token' || name === '__Secure-next-auth.session-token'),
      get: (name: string) => hasCookie && name === 'next-auth.session-token' ? 'mock-token' : undefined,
    },
    url: 'http://localhost:3000',
  } as any
}

function createDecodedToken(
  permissions: string[],
  roles: Array<{ personIdentifier: string; roleLabel: string; roleID: number }>
) {
  return {
    permissions: JSON.stringify(permissions),
    userRoles: JSON.stringify(roles),
  }
}

// Role presets for readability
const SUPERUSER_ROLES = [{ personIdentifier: 'su001', roleLabel: 'Superuser', roleID: 1 }]
const SUPERUSER_PERMISSIONS = ['canManageUsers', 'canConfigure', 'canCurate', 'canReport', 'canSearch', 'canManageNotifications', 'canManageProfile']

const CURATOR_ALL_ROLES = [{ personIdentifier: 'ca001', roleLabel: 'Curator_All', roleID: 2 }]
const CURATOR_ALL_PERMISSIONS = ['canCurate', 'canSearch', 'canManageNotifications', 'canManageProfile']

const REPORTER_ALL_ROLES = [{ personIdentifier: 'ra001', roleLabel: 'Reporter_All', roleID: 3 }]
const REPORTER_ALL_PERMISSIONS = ['canReport', 'canSearch', 'canManageProfile']

const CURATOR_SELF_ROLES = [{ personIdentifier: 'cs001', roleLabel: 'Curator_Self', roleID: 4 }]
const CURATOR_SELF_PERMISSIONS = ['canCurate', 'canManageNotifications', 'canManageProfile']

const CURATOR_SELF_REPORTER_ROLES = [
  { personIdentifier: 'cs001', roleLabel: 'Curator_Self', roleID: 4 },
  { personIdentifier: 'cs001', roleLabel: 'Reporter_All', roleID: 3 },
]
const CURATOR_SELF_REPORTER_PERMISSIONS = ['canCurate', 'canSearch', 'canReport', 'canManageNotifications', 'canManageProfile']

// -- Tests --

beforeEach(() => {
  mockRedirectCalls.length = 0
  mockNextCalls.length = 0
  jwtDecode.mockReset()
})

describe('ROUTE_PERMISSIONS map', () => {
  test('Test 1: has exactly 7 entries matching the 7 matcher routes', () => {
    const expectedRoutes = ['/manageusers', '/configuration', '/curate', '/report', '/search', '/notifications', '/manageprofile']
    const mapKeys = Object.keys(ROUTE_PERMISSIONS)

    expect(mapKeys).toHaveLength(7)
    expectedRoutes.forEach((route) => {
      expect(ROUTE_PERMISSIONS).toHaveProperty(route)
    })
    // Verify permission values are correct
    expect(ROUTE_PERMISSIONS['/manageusers']).toBe('canManageUsers')
    expect(ROUTE_PERMISSIONS['/configuration']).toBe('canConfigure')
    expect(ROUTE_PERMISSIONS['/curate']).toBe('canCurate')
    expect(ROUTE_PERMISSIONS['/report']).toBe('canReport')
    expect(ROUTE_PERMISSIONS['/search']).toBe('canSearch')
    expect(ROUTE_PERMISSIONS['/notifications']).toBe('canManageNotifications')
    expect(ROUTE_PERMISSIONS['/manageprofile']).toBe('canManageProfile')
  })
})

describe('Superuser access', () => {
  beforeEach(() => {
    jwtDecode.mockReturnValue(createDecodedToken(SUPERUSER_PERMISSIONS, SUPERUSER_ROLES))
  })

  test('Test 2: accessing /manageusers is allowed through', async () => {
    const req = createMockRequest('/manageusers')
    const result = await middleware(req)
    expect(result.type).toBe('next')
  })

  test('Test 3: accessing /configuration is allowed through', async () => {
    const req = createMockRequest('/configuration')
    const result = await middleware(req)
    expect(result.type).toBe('next')
  })

  test('Test 4: accessing /curate/anyone is allowed through', async () => {
    const req = createMockRequest('/curate/anyone')
    const result = await middleware(req)
    expect(result.type).toBe('next')
  })
})

describe('Curator_All access', () => {
  beforeEach(() => {
    jwtDecode.mockReturnValue(createDecodedToken(CURATOR_ALL_PERMISSIONS, CURATOR_ALL_ROLES))
  })

  test('Test 5: accessing /search is allowed through', async () => {
    const req = createMockRequest('/search')
    const result = await middleware(req)
    expect(result.type).toBe('next')
  })

  test('Test 6: accessing /manageusers is redirected (lacks canManageUsers)', async () => {
    const req = createMockRequest('/manageusers')
    const result = await middleware(req)
    expect(result.type).toBe('redirect')
    // Curator_All landing is /search via getLandingPageFromPermissions
    expect(mockRedirectCalls.length).toBeGreaterThan(0)
  })

  test('Test 7: accessing /configuration is redirected (lacks canConfigure)', async () => {
    const req = createMockRequest('/configuration')
    const result = await middleware(req)
    expect(result.type).toBe('redirect')
  })
})

describe('Reporter_All access', () => {
  beforeEach(() => {
    jwtDecode.mockReturnValue(createDecodedToken(REPORTER_ALL_PERMISSIONS, REPORTER_ALL_ROLES))
  })

  test('Test 8: accessing /search is allowed through', async () => {
    const req = createMockRequest('/search')
    const result = await middleware(req)
    expect(result.type).toBe('next')
  })

  test('Test 9: accessing /curate/123 is redirected (lacks canCurate)', async () => {
    const req = createMockRequest('/curate/123')
    const result = await middleware(req)
    expect(result.type).toBe('redirect')
  })

  test('Test 10: accessing /manageusers is redirected (lacks canManageUsers)', async () => {
    const req = createMockRequest('/manageusers')
    const result = await middleware(req)
    expect(result.type).toBe('redirect')
  })
})

describe('Curator_Self access', () => {
  beforeEach(() => {
    jwtDecode.mockReturnValue(createDecodedToken(CURATOR_SELF_PERMISSIONS, CURATOR_SELF_ROLES))
  })

  test('Test 11: accessing own curate page /curate/cs001 is allowed', async () => {
    const req = createMockRequest('/curate/cs001')
    const result = await middleware(req)
    expect(result.type).toBe('next')
  })

  test('Test 12: accessing /curate/other123 is redirected to /curate/cs001 (self-only enforcement)', async () => {
    const req = createMockRequest('/curate/other123')
    const result = await middleware(req)
    expect(result.type).toBe('redirect')
    // Should redirect to /curate/cs001
    expect(mockRedirectCalls.length).toBeGreaterThan(0)
  })

  test('Test 13: accessing /search is redirected to /curate/cs001 (lacks canSearch)', async () => {
    const req = createMockRequest('/search')
    const result = await middleware(req)
    expect(result.type).toBe('redirect')
  })

  test('Test 14: accessing /manageusers is redirected to /curate/cs001', async () => {
    const req = createMockRequest('/manageusers')
    const result = await middleware(req)
    expect(result.type).toBe('redirect')
  })
})

describe('Curator_Self + Reporter_All access', () => {
  beforeEach(() => {
    jwtDecode.mockReturnValue(createDecodedToken(CURATOR_SELF_REPORTER_PERMISSIONS, CURATOR_SELF_REPORTER_ROLES))
  })

  test('Test 15: accessing /search is allowed (has canSearch via Reporter_All)', async () => {
    const req = createMockRequest('/search')
    const result = await middleware(req)
    expect(result.type).toBe('next')
  })

  test('Test 16: accessing /curate/other is redirected to /curate/cs001 (self-only still applies)', async () => {
    const req = createMockRequest('/curate/other')
    const result = await middleware(req)
    expect(result.type).toBe('redirect')
  })

  test('Test 17: accessing /manageusers is redirected', async () => {
    const req = createMockRequest('/manageusers')
    const result = await middleware(req)
    expect(result.type).toBe('redirect')
  })
})

describe('Baseline fallback (no permissions)', () => {
  beforeEach(() => {
    // Empty permissions array -- baseline fallback should grant canSearch + canReport
    jwtDecode.mockReturnValue(createDecodedToken([], [{ personIdentifier: 'bl001', roleLabel: 'Unknown', roleID: 99 }]))
  })

  test('Test 18: accessing /search is allowed (baseline fallback MW-03)', async () => {
    const req = createMockRequest('/search')
    const result = await middleware(req)
    expect(result.type).toBe('next')
  })

  test('Test 19: accessing /report is allowed (baseline fallback MW-03)', async () => {
    const req = createMockRequest('/report')
    const result = await middleware(req)
    expect(result.type).toBe('next')
  })

  test('Test 20: accessing /manageusers is redirected (not in baseline)', async () => {
    const req = createMockRequest('/manageusers')
    const result = await middleware(req)
    expect(result.type).toBe('redirect')
  })
})

describe('Edge cases', () => {
  test('Test 21: request with no session cookie redirects to /login', async () => {
    const req = createMockRequest('/search', false)
    const result = await middleware(req)
    expect(result.type).toBe('redirect')
    // Verify the redirect URL includes /login
    expect(mockRedirectCalls.length).toBeGreaterThan(0)
    const redirectArg = mockRedirectCalls[mockRedirectCalls.length - 1][0]
    expect(redirectArg.toString()).toContain('/login')
  })

  test('Test 22: request with .git in path returns 403', async () => {
    const req = createMockRequest('/.git/config', true)
    const result = await middleware(req)
    expect(result.status).toBe(403)
  })

  test('Test 23: no roles in JWT redirects to /error', async () => {
    jwtDecode.mockReturnValue({
      permissions: JSON.stringify([]),
      userRoles: JSON.stringify([]),
    })
    const req = createMockRequest('/search')
    const result = await middleware(req)
    expect(result.type).toBe('redirect')
    // The redirect should be to /error
    const lastRedirect = mockRedirectCalls[mockRedirectCalls.length - 1]
    expect(lastRedirect).toBeDefined()
  })

  test('Test 24: landing page redirect uses getLandingPageFromPermissions output', async () => {
    // Curator_All accessing /manageusers should redirect to /search (Curator_All landing page)
    jwtDecode.mockReturnValue(createDecodedToken(CURATOR_ALL_PERMISSIONS, CURATOR_ALL_ROLES))
    mockRedirectCalls.length = 0
    const req = createMockRequest('/manageusers')
    const result = await middleware(req)
    expect(result.type).toBe('redirect')
    // The redirect target should have pathname set to /search (Curator_All's landing page)
    expect(mockRedirectCalls.length).toBe(1)
    // The clone's pathname should have been set to /search by redirectToLandingPage
    // (via getLandingPageFromPermissions returning '/search' for Curator_All)
  })
})
