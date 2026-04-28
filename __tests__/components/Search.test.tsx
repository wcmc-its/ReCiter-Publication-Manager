import React from 'react'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createStore, applyMiddleware } from 'redux'
import thunk from 'redux-thunk'

// Mock next-auth/client
jest.mock('next-auth/client', () => ({
  useSession: () => [{
    data: { username: 'test', userRoles: '["Superuser"]' },
    adminSettings: JSON.stringify([
      {
        viewName: 'findPeople',
        viewAttributes: JSON.stringify([
          { labelUserKey: 'personIdentifier', labelUserView: 'CWID' },
          { labelUserKey: 'organization', labelUserView: 'Organization' },
          { labelUserKey: 'institution', labelUserView: 'Institution' },
          { labelUserKey: 'personType', labelUserView: 'Person Type' },
        ]),
      },
    ]),
  }, false],
  getSession: () => Promise.resolve(null),
}))

// Mock next/router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    query: {},
    pathname: '/search',
    asPath: '/search',
  }),
}))

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  useHistory: () => ({ push: jest.fn() }),
}))

// Mock fetchWithTimeout
jest.mock('../../src/utils/fetchWithTimeout', () =>
  jest.fn(() =>
    Promise.resolve({
      status: 200,
      json: () => Promise.resolve({ countPersonIdentifier: 0 }),
    })
  )
)

// Mock config/local
jest.mock('../../config/local', () => ({
  reciterConfig: {
    backendApiKey: 'test-api-key',
    reciter: {
      adminApiKey: 'test-key',
      reciterIdentityEndpoints: {
        identityByUid: 'http://localhost/identity',
        getAllIdentity: 'http://localhost/identities',
        identityImageEndpoint: 'http://localhost/image/${uid}.png',
      },
      featureGenerator: {
        featureGeneratorEndpoint: 'http://localhost/feature',
        featutreGeneratorApiParams: {
          totalStandardizedArticleScore: 3,
          useGoldStandard: 'AS_EVIDENCE',
          analysisRefreshFlag: 'false',
          retrievalRefreshFlag: 'FALSE',
          filterByFeedback: 'ALL',
        },
      },
      featureGeneratorByGroup: {
        featureGeneratorByGroupEndpoint: 'http://localhost/group',
        featureGeneratorByGroupApiParams: {
          totalStandardizedArticleScore: 3,
          maxArticlesPerPerson: 4,
        },
        maxResultsOnGroupView: 60,
        incrementResultsBy: 20,
      },
    },
  },
}))

// Minimal Redux state matching Search.js dependencies
const mockReducer = (
  state = {
    identityAllData: [],
    identityAllFetching: false,
    identityPaginatedData: { persons: [], totalPersonsCount: [] },
    identityPaginatedFetching: false,
    filters: {},
    updatedAdminSettings: [],
    errors: [],
    reciterData: { reciter: [] },
    filteredIdentities: [],
    orgUnitsData: [],
    institutionsData: [],
    personTypesData: [],
  },
  action
) => state

// Import after mocks
import Search from '../../src/components/elements/Search/Search'

describe('Search', () => {
  it('renders without crashing', () => {
    const store = createStore(mockReducer, applyMiddleware(thunk))
    render(
      <Provider store={store}>
        <Search />
      </Provider>
    )
    expect(screen.getByText(/Find People/i)).toBeInTheDocument()
  })

  it('renders search heading element', () => {
    const store = createStore(mockReducer, applyMiddleware(thunk))
    const { container } = render(
      <Provider store={store}>
        <Search />
      </Provider>
    )
    const heading = container.querySelector('h1')
    expect(heading).not.toBeNull()
    expect(heading.textContent).toMatch(/Find People/)
  })
})

describe('ProxyBadge in search results', () => {
  it('should render ProxyBadge for proxied person', () => {
    // Override useSession to include proxyPersonIds
    const nextAuth = require('next-auth/client')
    const originalUseSession = nextAuth.useSession
    nextAuth.useSession = () => [{
      data: {
        username: 'test',
        userRoles: '["Curator_Scoped"]',
        scopeData: JSON.stringify({ personTypes: ['faculty-academic'], orgUnits: null }),
        proxyPersonIds: JSON.stringify(['proxy001']),
      },
      adminSettings: JSON.stringify([
        {
          viewName: 'findPeople',
          viewAttributes: JSON.stringify([
            { labelUserKey: 'personIdentifier', labelUserView: 'CWID' },
            { labelUserKey: 'organization', labelUserView: 'Organization' },
            { labelUserKey: 'institution', labelUserView: 'Institution' },
            { labelUserKey: 'personType', labelUserView: 'Person Type' },
          ]),
        },
      ]),
    }, false]

    const mockReducerWithProxyPerson = (
      state = {
        identityAllData: [],
        identityAllFetching: false,
        identityPaginatedData: {
          persons: [
            {
              personIdentifier: 'proxy001',
              firstName: 'Jane',
              middleName: '',
              lastName: 'Doe',
              primaryOrganizationalUnit: 'Surgery',
              primaryInstitution: 'Weill Cornell',
              title: 'Professor',
            },
          ],
          totalPersonsCount: [{ count: 1 }],
        },
        identityPaginatedFetching: false,
        filters: {},
        updatedAdminSettings: [],
        errors: [],
        reciterData: { reciter: [] },
        filteredIdentities: [],
        orgUnitsData: [],
        institutionsData: [],
        personTypesData: [],
        showOnlyScopeFiltered: false,
      },
      action
    ) => state

    const store = createStore(mockReducerWithProxyPerson, applyMiddleware(thunk))
    render(
      <Provider store={store}>
        <Search />
      </Provider>
    )

    expect(screen.getByText('PROXY')).toBeInTheDocument()

    // Restore original useSession
    nextAuth.useSession = originalUseSession
  })
})
