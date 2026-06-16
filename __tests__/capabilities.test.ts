import { getCapabilities, getLandingPage } from '../src/utils/constants'

describe('getCapabilities', () => {
  it('returns baseline capabilities for no roles', () => {
    const caps = getCapabilities([])
    expect(caps.canReport).toBe(true)
    expect(caps.canSearch).toBe(true)
    expect(caps.canCurate.all).toBe(false)
    expect(caps.canCurate.self).toBe(false)
    expect(caps.canCurate.scoped).toBe(false)
    expect(caps.canManageUsers).toBe(false)
    expect(caps.canConfigure).toBe(false)
  })

  it('returns baseline for null input', () => {
    const caps = getCapabilities(null)
    expect(caps.canReport).toBe(true)
    expect(caps.canSearch).toBe(true)
  })

  it('grants full access for Superuser', () => {
    const caps = getCapabilities([{ roleLabel: 'Superuser', personIdentifier: 'paa2013' }])
    expect(caps.canCurate.all).toBe(true)
    expect(caps.canReport).toBe(true)
    expect(caps.canSearch).toBe(true)
    expect(caps.canManageUsers).toBe(true)
    expect(caps.canConfigure).toBe(true)
  })

  it('grants scoped curation for Curator_Scoped', () => {
    const caps = getCapabilities([{ roleLabel: 'Curator_Scoped', personIdentifier: 'paa2013' }])
    expect(caps.canCurate.scoped).toBe(true)
    expect(caps.canCurate.all).toBe(false)
    expect(caps.canSearch).toBe(true)
  })

  it('grants scoped curation for Curator_Department', () => {
    const caps = getCapabilities([{ roleLabel: 'Curator_Department', personIdentifier: 'paa2013' }])
    expect(caps.canCurate.scoped).toBe(true)
    expect(caps.canCurate.all).toBe(false)
  })

  it('grants scoped curation for Curator_Department_Delegate', () => {
    const caps = getCapabilities([{ roleLabel: 'Curator_Department_Delegate', personIdentifier: 'paa2013' }])
    expect(caps.canCurate.scoped).toBe(true)
  })

  it('grants self curation for Curator_Self', () => {
    const caps = getCapabilities([{ roleLabel: 'Curator_Self', personIdentifier: 'paa2013' }])
    expect(caps.canCurate.self).toBe(true)
    expect(caps.canCurate.all).toBe(false)
    expect(caps.canCurate.personIdentifier).toBe('paa2013')
  })

  it('merges capabilities across multiple roles (OR logic)', () => {
    const caps = getCapabilities([
      { roleLabel: 'Curator_Self', personIdentifier: 'paa2013' },
      { roleLabel: 'Reporter_All', personIdentifier: 'paa2013' },
    ])
    expect(caps.canCurate.self).toBe(true)
    expect(caps.canReport).toBe(true)
    expect(caps.canSearch).toBe(true)
    expect(caps.canCurate.all).toBe(false)
  })

  it('ignores unknown roles gracefully', () => {
    const caps = getCapabilities([{ roleLabel: 'FutureRole', personIdentifier: 'paa2013' }])
    expect(caps.canReport).toBe(true) // baseline
    expect(caps.canCurate.all).toBe(false)
  })
})

describe('getLandingPage', () => {
  it('returns /curate/:id for self-only curators', () => {
    const caps = getCapabilities([{ roleLabel: 'Curator_Self', personIdentifier: 'paa2013' }])
    expect(getLandingPage(caps)).toBe('/curate/paa2013')
  })

  it('returns /search for Curator_All', () => {
    const caps = getCapabilities([{ roleLabel: 'Curator_All', personIdentifier: 'paa2013' }])
    expect(getLandingPage(caps)).toBe('/search')
  })

  it('returns /search for Curator_Scoped', () => {
    const caps = getCapabilities([{ roleLabel: 'Curator_Scoped', personIdentifier: 'paa2013' }])
    expect(getLandingPage(caps)).toBe('/search')
  })

  it('returns /search for Reporter_All', () => {
    const caps = getCapabilities([{ roleLabel: 'Reporter_All', personIdentifier: 'paa2013' }])
    expect(getLandingPage(caps)).toBe('/search')
  })

  it('returns /curate/:id for Curator_Self + Reporter_All (self takes priority)', () => {
    const caps = getCapabilities([
      { roleLabel: 'Curator_Self', personIdentifier: 'paa2013' },
      { roleLabel: 'Reporter_All', personIdentifier: 'paa2013' },
    ])
    // Self-only curators always land on their curate page, even with Reporter_All
    expect(getLandingPage(caps)).toBe('/curate/paa2013')
  })
})
