import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ScopeFilterCheckbox from '../../src/components/elements/Search/ScopeFilterCheckbox';

describe('ScopeFilterCheckbox', () => {
  it('renders switch with label "Show only people in my scope"', () => {
    render(<ScopeFilterCheckbox checked={false} onChange={jest.fn()} />);
    expect(screen.getByLabelText('Show only people in my scope')).toBeInTheDocument();
  });

  it('checked state reflects the checked prop (true -> checked, false -> unchecked)', () => {
    const { rerender } = render(
      <ScopeFilterCheckbox checked={true} onChange={jest.fn()} />
    );
    const switchEl = screen.getByRole('checkbox') as HTMLInputElement;
    expect(switchEl.checked).toBe(true);

    rerender(<ScopeFilterCheckbox checked={false} onChange={jest.fn()} />);
    expect(switchEl.checked).toBe(false);
  });

  it('calls onChange with toggled value when switch is clicked', () => {
    const handleChange = jest.fn();
    render(<ScopeFilterCheckbox checked={false} onChange={handleChange} />);
    const switchEl = screen.getByRole('checkbox');
    fireEvent.click(switchEl);
    expect(handleChange).toHaveBeenCalledWith(true);
  });
});
