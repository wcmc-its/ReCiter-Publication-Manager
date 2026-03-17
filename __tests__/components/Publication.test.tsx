import React from 'react'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createStore } from 'redux'

// Mock next-auth/client
jest.mock('next-auth/client', () => ({
  useSession: () => [{
    data: { username: 'test', userRoles: '[]' },
  }, false],
  getSession: () => Promise.resolve(null),
}))

// Mock config/local
jest.mock('../../config/local', () => ({
  reciterConfig: {
    backendApiKey: 'test-api-key',
    reciter: {
      featureGeneratorByGroup: {
        featureGeneratorByGroupApiParams: {
          maxArticlesPerPerson: 4,
        },
      },
    },
  },
}))

// Minimal Redux state matching Publication.tsx dependencies
const mockReducer = (
  state = {
    feedbacklog: [],
    filteredIdentities: [],
    reciterData: { reciter: [] },
  },
  action
) => state

// Import after mocks
import Publication from '../../src/components/elements/Publication/Publication'

const defaultProps = {
  reciterArticle: {
    pmid: 12345678,
    articleTitle: 'Test Article Title',
    totalArticleScoreStandardized: 8.5,
    totalArticleScoreNonStandardized: 12.3,
    userAssertion: 'NULL',
    publicationDateStandardized: '2024/01/15',
    publicationDateDisplay: '2024 Jan',
    evidence: {},
    positiveEvidence: [],
    pmcid: '',
    doi: '10.1234/test',
    publicationType: { publicationTypeCanonical: 'Academic Article' },
    journalTitleVerbose: 'Test Journal',
    reCiterArticleAuthorFeatures: [
      { firstName: 'Test', lastName: 'Author', targetAuthor: true },
    ],
  },
  index: 'page10',
  personIdentifier: 'test123',
  fullName: 'Test Person',
  item: {
    title: 'Test Article Title',
    journal: { journalTitle: 'Test Journal' },
    pmid: 12345678,
    authors: [{ firstName: 'Test', lastName: 'Author' }],
    publicationDateDisplay: '2024 Jan',
    doi: '10.1234/test',
    publicationType: { publicationType: 'Academic Article' },
  },
  updatePublication: jest.fn(),
  onAccept: jest.fn(),
  onReject: jest.fn(),
  onUndo: jest.fn(),
}

describe('Publication', () => {
  it('renders without crashing', () => {
    const store = createStore(mockReducer)
    const { container } = render(
      <Provider store={store}>
        <Publication {...defaultProps} />
      </Provider>
    )
    expect(container.firstChild).not.toBeNull()
  })

  it('displays article title when provided', () => {
    const store = createStore(mockReducer)
    render(
      <Provider store={store}>
        <Publication {...defaultProps} />
      </Provider>
    )
    expect(screen.getByText('Test Article Title')).toBeInTheDocument()
  })
})
