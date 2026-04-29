import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProxyBadge from '../../src/components/elements/Search/ProxyBadge';

describe('ProxyBadge', () => {
  it('renders text "Proxy" in the DOM', () => {
    render(<ProxyBadge />);
    expect(screen.getByText('Proxy')).toBeInTheDocument();
  });

  it('rendered element contains Bootstrap badge class', () => {
    render(<ProxyBadge />);
    const badge = screen.getByText('Proxy');
    expect(badge).toHaveClass('badge');
  });
});
