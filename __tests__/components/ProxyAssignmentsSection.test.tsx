import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../../config/local', () => ({
  reciterConfig: {
    backendApiKey: 'test-api-key',
  },
}));

import ProxyAssignmentsSection from '../../src/components/elements/AddUser/ProxyAssignmentsSection';

const defaultProps = {
  selectedProxies: [],
  onProxiesChange: jest.fn(),
  baseSx: {},
};

describe('ProxyAssignmentsSection', () => {
  it('renders "Proxy Assignments" section title', () => {
    render(<ProxyAssignmentsSection {...defaultProps} />);
    expect(screen.getByText('Proxy Assignments')).toBeInTheDocument();
  });

  it('renders the search placeholder "Search people to add as proxies..."', () => {
    render(<ProxyAssignmentsSection {...defaultProps} />);
    expect(
      screen.getByPlaceholderText('Search people to add as proxies...')
    ).toBeInTheDocument();
  });
});
