import React from 'react'
import { render, screen } from '@testing-library/react'
import { Provider } from 'react-redux'
import { createStore } from 'redux'

// Mock next-auth/client
jest.mock('next-auth/client', () => ({
  useSession: () => [{
    data: { username: 'test', userRoles: '[]' }
  }, false],
  getSession: () => Promise.resolve(null),
}))

// Minimal reducer matching the state shape Tabs.js needs
const mockReducer = (state = {
  reciterData: {
    reciter: [
      { userAssertion: 'ACCEPTED' },
      { userAssertion: 'NULL' },
      { userAssertion: 'NULL' },
      { userAssertion: 'REJECTED' },
    ]
  }
}, action) => state

// Import after mocks
import Tabs from '../../src/components/elements/Tabs/Tabs'

describe('Tabs (react-bootstrap replacement)', () => {
  it('renders without crashing and uses Nav.Link instead of anchor tags', () => {
    const store = createStore(mockReducer)
    const tabClickHandler = jest.fn()

    const { container } = render(
      <Provider store={store}>
        <Tabs tabActive="Suggested" tabClickHandler={tabClickHandler} />
      </Provider>
    )

    // Verify tab text is present
    expect(screen.getByText(/Accepted/)).toBeInTheDocument()
    expect(screen.getByText(/Suggested/)).toBeInTheDocument()
    expect(screen.getByText(/Rejected/)).toBeInTheDocument()
    expect(screen.getByText(/Add Publication/)).toBeInTheDocument()

    // Verify all anchor elements have role="button" and tabIndex for keyboard access
    // (react-bootstrap Nav.Link renders <a role="button" tabIndex={0}>)
    const anchors = container.querySelectorAll('a')
    anchors.forEach((anchor) => {
      expect(anchor.getAttribute('role')).toBe('button')
      expect(anchor.getAttribute('tabindex')).toBe('0')
    })
  })

  it('shows correct counts for each tab', () => {
    const store = createStore(mockReducer)
    const { container } = render(
      <Provider store={store}>
        <Tabs tabActive="Suggested" tabClickHandler={jest.fn()} />
      </Provider>
    )

    // 1 accepted, 2 suggested, 1 rejected
    const ones = screen.getAllByText('1')
    expect(ones.length).toBe(2) // accepted=1 and rejected=1
    expect(screen.getByText('2')).toBeInTheDocument() // suggested count
  })
})
