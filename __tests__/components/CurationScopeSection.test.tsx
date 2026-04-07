import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CurationScopeSection from '../../src/components/elements/AddUser/CurationScopeSection';

const defaultProps = {
  selectedPersonTypes: [],
  onPersonTypesChange: jest.fn(),
  selectedOrgUnits: [],
  onOrgUnitsChange: jest.fn(),
  personTypeOptions: ['Faculty', 'Staff'],
  orgUnitOptions: ['Cardiology', 'Neurology'],
  baseSx: {},
  renderOrgTags: (value: string[], getTagProps: any) =>
    value.map((v, i) => <span key={i}>{v}</span>),
};

describe('CurationScopeSection', () => {
  it('renders "Curation Scope" section title', () => {
    render(<CurationScopeSection {...defaultProps} />);
    expect(screen.getByText('Curation Scope')).toBeInTheDocument();
  });

  it('renders "Person type(s)" and "Organizational unit(s)" labels', () => {
    render(<CurationScopeSection {...defaultProps} />);
    expect(screen.getByText('Person type(s)')).toBeInTheDocument();
    expect(screen.getByText('Organizational unit(s)')).toBeInTheDocument();
  });

  it('renders error text when error prop is provided', () => {
    render(<CurationScopeSection {...defaultProps} error="Scope is required" />);
    expect(screen.getByText('Scope is required')).toBeInTheDocument();
  });
});
