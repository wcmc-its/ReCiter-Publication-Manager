import { isPersonInScope, isProxyFor, ScopeData } from '../src/utils/scopeResolver'

describe('isPersonInScope', () => {
  it('returns true when scope is null', () => {
    expect(isPersonInScope(null as any, 'Medicine', ['academic-faculty'])).toBe(true)
  })

  it('returns true when scope has no restrictions', () => {
    const scope: ScopeData = { personTypes: null, orgUnits: null }
    expect(isPersonInScope(scope, 'Medicine', ['academic-faculty'])).toBe(true)
  })

  it('returns true when person org unit matches', () => {
    const scope: ScopeData = { personTypes: null, orgUnits: ['Medicine', 'Pediatrics'] }
    expect(isPersonInScope(scope, 'Medicine', ['academic-faculty'])).toBe(true)
  })

  it('returns false when person org unit does not match', () => {
    const scope: ScopeData = { personTypes: null, orgUnits: ['Medicine'] }
    expect(isPersonInScope(scope, 'Surgery', ['academic-faculty'])).toBe(false)
  })

  it('returns false when person has no org unit and scope restricts by org unit', () => {
    const scope: ScopeData = { personTypes: null, orgUnits: ['Medicine'] }
    expect(isPersonInScope(scope, null, ['academic-faculty'])).toBe(false)
  })

  it('returns true when person type matches (OR within dimension)', () => {
    const scope: ScopeData = { personTypes: ['academic-faculty', 'academic-counselor'], orgUnits: null }
    expect(isPersonInScope(scope, 'Medicine', ['student-phd', 'academic-faculty'])).toBe(true)
  })

  it('returns false when no person type matches', () => {
    const scope: ScopeData = { personTypes: ['academic-faculty'], orgUnits: null }
    expect(isPersonInScope(scope, 'Medicine', ['student-phd'])).toBe(false)
  })

  it('returns false when person has no types and scope restricts by type', () => {
    const scope: ScopeData = { personTypes: ['academic-faculty'], orgUnits: null }
    expect(isPersonInScope(scope, 'Medicine', [])).toBe(false)
  })

  it('enforces AND across dimensions — both must match', () => {
    const scope: ScopeData = { personTypes: ['academic-faculty'], orgUnits: ['Medicine'] }
    // Right type, wrong org
    expect(isPersonInScope(scope, 'Surgery', ['academic-faculty'])).toBe(false)
    // Wrong type, right org
    expect(isPersonInScope(scope, 'Medicine', ['student-phd'])).toBe(false)
    // Both match
    expect(isPersonInScope(scope, 'Medicine', ['academic-faculty'])).toBe(true)
  })
})

describe('isProxyFor', () => {
  it('returns false when proxyPersonIds is null', () => {
    expect(isProxyFor(null, 'paa2013')).toBe(false)
  })

  it('returns false when proxyPersonIds is empty', () => {
    expect(isProxyFor([], 'paa2013')).toBe(false)
  })

  it('returns true when personIdentifier is in the proxy list', () => {
    expect(isProxyFor(['paa2013', 'abc1234'], 'paa2013')).toBe(true)
  })

  it('returns false when personIdentifier is not in the proxy list', () => {
    expect(isProxyFor(['abc1234', 'xyz9999'], 'paa2013')).toBe(false)
  })
})
