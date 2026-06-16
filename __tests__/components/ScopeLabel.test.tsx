import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ScopeLabel from '../../src/components/elements/Navbar/ScopeLabel';

describe('ScopeLabel', () => {
  it('returns null (empty container) when scopeData is null and proxyCount is 0', () => {
    const { container } = render(<ScopeLabel scopeData={null} proxyCount={0} />);
    expect(container.firstChild).toBeNull();
  });

  it('displays scope items as comma-separated text when scopeData has personTypes and orgUnits', () => {
    const scopeData = {
      personTypes: ['Faculty'],
      orgUnits: ['Cardiology'],
    };
    render(<ScopeLabel scopeData={scopeData} proxyCount={0} />);
    expect(screen.getByText('Faculty, Cardiology')).toBeInTheDocument();
  });

  it('truncates after 3 items and shows "+N more" for overflow (4+ items)', () => {
    const scopeData = {
      personTypes: ['Faculty', 'Staff', 'Student'],
      orgUnits: ['Cardiology', 'Neurology'],
    };
    render(<ScopeLabel scopeData={scopeData} proxyCount={0} />);
    expect(screen.getByText(/Faculty, Staff, Student \+2 more/)).toBeInTheDocument();
  });

  it('shows proxy count text "N proxies" when proxyCount > 1', () => {
    render(<ScopeLabel scopeData={null} proxyCount={3} />);
    expect(screen.getByText('3 proxies')).toBeInTheDocument();
  });

  it('uses singular "1 proxy" when proxyCount is 1', () => {
    render(<ScopeLabel scopeData={null} proxyCount={1} />);
    expect(screen.getByText('1 proxy')).toBeInTheDocument();
  });
});
