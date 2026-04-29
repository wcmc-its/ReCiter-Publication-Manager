import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('../../config/local', () => ({
  reciterConfig: {
    backendApiKey: 'test-api-key',
  },
}));

jest.mock('react-toastify', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock('../../src/components/elements/Common/Loader', () => {
  return function MockLoader() {
    return <div data-testid="loader" />;
  };
});

import GrantProxyModal from '../../src/components/elements/CurateIndividual/GrantProxyModal';

const defaultProps = {
  show: true,
  onHide: jest.fn(),
  personIdentifier: 'abc123',
  personName: 'John Doe',
  onSave: jest.fn(),
};

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([]),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('GrantProxyModal', () => {
  it('renders modal with "Manage Proxy Access" title when show=true', async () => {
    render(<GrantProxyModal {...defaultProps} />);
    expect(screen.getByText('Manage Proxy Access')).toBeInTheDocument();
    // Wait for async loadExisting to settle
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('renders "Discard Changes" and "Save Changes" buttons', async () => {
    render(<GrantProxyModal {...defaultProps} />);
    // Wait for async loadExisting to settle
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    expect(screen.getByText('Discard Changes')).toBeInTheDocument();
    expect(screen.getByText('Save Changes')).toBeInTheDocument();
  });

  it('does not render modal content when show=false', () => {
    render(<GrantProxyModal {...defaultProps} show={false} />);
    expect(screen.queryByText('Manage Proxy Access')).not.toBeInTheDocument();
  });
});
