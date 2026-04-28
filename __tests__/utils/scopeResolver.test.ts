/**
 * Tests for isPersonInScope() -- centralized scope resolution logic.
 * Verifies AND across dimensions (person type + org unit) and OR within each dimension.
 */

import { isPersonInScope, ScopeData } from '../../src/utils/scopeResolver'

describe('isPersonInScope', () => {
  describe('person type only (orgUnits = null)', () => {
    it('should match when person has matching type', () => {
      const scope: ScopeData = { personTypes: ['Faculty'], orgUnits: null }
      expect(isPersonInScope(scope, 'Surgery', ['Faculty'])).toBe(true)
    })

    it('should not match when person has non-matching type', () => {
      const scope: ScopeData = { personTypes: ['Faculty'], orgUnits: null }
      expect(isPersonInScope(scope, 'Surgery', ['Staff'])).toBe(false)
    })

    it('should match if any person type matches (OR within)', () => {
      const scope: ScopeData = { personTypes: ['Faculty', 'Staff'], orgUnits: null }
      expect(isPersonInScope(scope, 'Surgery', ['Student', 'Faculty'])).toBe(true)
    })

    it('should not match when person has no types and scope requires types', () => {
      const scope: ScopeData = { personTypes: ['Faculty'], orgUnits: null }
      expect(isPersonInScope(scope, null, [])).toBe(false)
    })
  })

  describe('org unit only (personTypes = null)', () => {
    it('should match when person org unit is in scope', () => {
      const scope: ScopeData = { personTypes: null, orgUnits: ['Surgery'] }
      expect(isPersonInScope(scope, 'Surgery', ['Staff'])).toBe(true)
    })

    it('should not match when person org unit is not in scope', () => {
      const scope: ScopeData = { personTypes: null, orgUnits: ['Surgery'] }
      expect(isPersonInScope(scope, 'Medicine', ['Staff'])).toBe(false)
    })

    it('should not match when person has no org unit and scope requires one', () => {
      const scope: ScopeData = { personTypes: null, orgUnits: ['Surgery'] }
      expect(isPersonInScope(scope, null, ['Faculty'])).toBe(false)
    })
  })

  describe('both dimensions (AND across, OR within)', () => {
    it('should match when both dimensions pass', () => {
      const scope: ScopeData = { personTypes: ['Faculty', 'Staff'], orgUnits: ['Surgery', 'Medicine'] }
      expect(isPersonInScope(scope, 'Surgery', ['Faculty'])).toBe(true)
    })

    it('should not match when org unit fails', () => {
      const scope: ScopeData = { personTypes: ['Faculty'], orgUnits: ['Surgery'] }
      expect(isPersonInScope(scope, 'Medicine', ['Faculty'])).toBe(false)
    })

    it('should not match when person type fails', () => {
      const scope: ScopeData = { personTypes: ['Faculty'], orgUnits: ['Surgery'] }
      expect(isPersonInScope(scope, 'Surgery', ['Staff'])).toBe(false)
    })
  })

  describe('edge cases (null/empty)', () => {
    it('should match everything when both dimensions are null (no restrictions)', () => {
      const scope: ScopeData = { personTypes: null, orgUnits: null }
      expect(isPersonInScope(scope, 'Anything', ['Whatever'])).toBe(true)
    })

    it('should match even with null org unit and empty types when no restrictions', () => {
      const scope: ScopeData = { personTypes: null, orgUnits: null }
      expect(isPersonInScope(scope, null, [])).toBe(true)
    })

    it('should handle multiple matching person types correctly', () => {
      const scope: ScopeData = { personTypes: ['Faculty', 'Staff'], orgUnits: null }
      expect(isPersonInScope(scope, 'Surgery', ['Faculty', 'Staff'])).toBe(true)
    })
  })
})
