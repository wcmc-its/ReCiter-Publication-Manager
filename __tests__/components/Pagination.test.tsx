import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import Pagination from '../../src/components/elements/Pagination/Pagination'

describe('Pagination', () => {
  const defaultProps = {
    count: 20,
    total: 100,
    page: 1,
    onChange: jest.fn(),
    onCountChange: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders without crashing', () => {
    render(<Pagination {...defaultProps} />)
    expect(screen.getByText(/Page/i)).toBeInTheDocument()
  })

  it('renders null when total is 0', () => {
    const { container } = render(<Pagination {...defaultProps} total={0} />)
    expect(container.firstChild).toBeNull()
  })

  it('displays correct page info', () => {
    render(<Pagination {...defaultProps} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText(/of 5/)).toBeInTheDocument()
  })

  it('has accessible Previous and Next buttons', () => {
    render(<Pagination {...defaultProps} page={2} />)
    const prevButton = screen.getByLabelText('Previous page')
    const nextButton = screen.getByLabelText('Next page')
    expect(prevButton).toBeInTheDocument()
    expect(nextButton).toBeInTheDocument()
    expect(prevButton.tagName).toBe('BUTTON')
    expect(nextButton.tagName).toBe('BUTTON')
  })

  it('disables Previous button on first page', () => {
    render(<Pagination {...defaultProps} page={1} />)
    const prevButton = screen.getByLabelText('Previous page')
    expect(prevButton).toBeDisabled()
  })

  it('disables Next button on last page', () => {
    render(<Pagination {...defaultProps} page={5} />)
    const nextButton = screen.getByLabelText('Next page')
    expect(nextButton).toBeDisabled()
  })

  it('has label associated with Show records dropdown', () => {
    render(<Pagination {...defaultProps} />)
    const label = screen.getByText('Show records')
    expect(label.tagName).toBe('LABEL')
    expect(label.getAttribute('for')).toBe('show-records-dropdown')
  })

  it('calls onChange when Next is clicked', () => {
    render(<Pagination {...defaultProps} page={2} />)
    const nextButton = screen.getByLabelText('Next page')
    fireEvent.click(nextButton)
    expect(defaultProps.onChange).toHaveBeenCalledWith(3)
  })
})
