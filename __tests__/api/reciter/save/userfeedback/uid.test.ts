/**
 * Tests for userfeedback save API endpoint proxy-before-scope logic.
 * Verifies:
 *   1. Proxy user bypasses scope check (200)
 *   2. Non-proxy out-of-scope user gets 403
 *   3. Curator_All user bypasses all checks (200)
 */

import { createMocks } from 'node-mocks-http'

// Mock dependencies before importing handler
// Paths are relative from THIS test file to the actual module on disk
jest.mock('../../../../../controllers/userfeedback.controller', () => ({
  saveUserFeedback: jest.fn().mockResolvedValue({ statusCode: 200, statusText: 'OK' }),
}))

jest.mock('../../../../../config/local', () => ({
  reciterConfig: {
    backendApiKey: 'test-api-key',
    tokenSecret: 'test-secret',
  },
}))

jest.mock('../../../../../controllers/db/person.controller', () => ({
  getPersonWithTypes: jest.fn().mockResolvedValue({
    primaryOrganizationalUnit: 'Radiology',
    personTypes: ['Staff'],
  }),
}))

// Mock next-auth/jwt
const mockGetToken = jest.fn()
jest.mock('next-auth/jwt', () => ({
  getToken: (...args: any[]) => mockGetToken(...args),
}))

import handler from '../../../../../src/pages/api/reciter/save/userfeedback/[uid]'

describe('userfeedback save API - proxy check', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should allow proxy user to save feedback without scope check (200)', async () => {
    // Curator_Scoped user who IS a proxy for the target person
    mockGetToken.mockResolvedValue({
      username: 'testuser',
      userRoles: JSON.stringify([{ roleLabel: 'Curator_Scoped', personIdentifier: 'user1' }]),
      scopeData: JSON.stringify({ personTypes: ['Faculty'], orgUnits: ['Surgery'] }),
      proxyPersonIds: JSON.stringify(['abc123']), // IS proxy for abc123
    })

    const { req, res } = createMocks({
      method: 'POST',
      query: { uid: 'abc123' },
      headers: { authorization: 'test-api-key' },
      body: { acceptedPmids: [12345], rejectedPmids: [] },
    })

    await handler(req as any, res as any)

    // Should get 200 -- proxy access short-circuits scope check
    expect(res._getStatusCode()).toBe(200)
  })

  it('should deny non-proxy out-of-scope curator with 403', async () => {
    // Curator_Scoped user who is NOT a proxy and NOT in scope
    mockGetToken.mockResolvedValue({
      username: 'testuser',
      userRoles: JSON.stringify([{ roleLabel: 'Curator_Scoped', personIdentifier: 'user1' }]),
      scopeData: JSON.stringify({ personTypes: ['Faculty'], orgUnits: ['Surgery'] }),
      proxyPersonIds: JSON.stringify([]), // NOT a proxy
    })

    const { req, res } = createMocks({
      method: 'POST',
      query: { uid: 'xyz789' }, // person in Radiology/Staff -- out of scope
      headers: { authorization: 'test-api-key' },
      body: { acceptedPmids: [12345], rejectedPmids: [] },
    })

    await handler(req as any, res as any)

    // Should get 403 -- not proxy, not in scope
    expect(res._getStatusCode()).toBe(403)
  })

  it('should allow Curator_All without any scope or proxy check', async () => {
    // Curator_All user -- bypasses all scope checks
    mockGetToken.mockResolvedValue({
      username: 'admin',
      userRoles: JSON.stringify([{ roleLabel: 'Curator_All', personIdentifier: 'admin1' }]),
      scopeData: null,
      proxyPersonIds: null,
    })

    const { req, res } = createMocks({
      method: 'POST',
      query: { uid: 'anyone' },
      headers: { authorization: 'test-api-key' },
      body: { acceptedPmids: [12345], rejectedPmids: [] },
    })

    await handler(req as any, res as any)

    // Should get 200 -- Curator_All bypasses everything
    expect(res._getStatusCode()).toBe(200)
  })
})
