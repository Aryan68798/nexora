import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { formatINR } from '../lib/utils';
import { Price } from '../components/ui/Price';

describe('formatINR utility', () => {
  it('formats zero correctly', () => {
    expect(formatINR(0)).toBe('₹0.00');
    expect(formatINR('0')).toBe('₹0.00');
    expect(formatINR('0.00')).toBe('₹0.00');
  });

  it('formats amounts under a thousand', () => {
    expect(formatINR('500.00')).toBe('₹500.00');
    expect(formatINR('999.50')).toBe('₹999.50');
  });

  it('formats thousands with Indian grouping (last 3, then groups of 2)', () => {
    expect(formatINR('1234.50')).toBe('₹1,234.50');
    expect(formatINR('12345.00')).toBe('₹12,345.00');
    expect(formatINR('123456.78')).toBe('₹1,23,456.78');
    expect(formatINR('1234567.89')).toBe('₹12,34,567.89');
    expect(formatINR('10000000.00')).toBe('₹1,00,00,000.00');
  });

  it('handles negative amounts correctly', () => {
    expect(formatINR('-500.00')).toBe('-₹500.00');
    expect(formatINR('-1234567.50')).toBe('-₹12,34,567.50');
  });

  it('pads missing decimal places to 2 digits', () => {
    expect(formatINR('100')).toBe('₹100.00');
    expect(formatINR('100.5')).toBe('₹100.50');
  });
});

describe('Price Component', () => {
  it('renders formatted price without float distortion', () => {
    render(<Price amount="1234567.50" />);
    expect(screen.getByText('₹12,34,567.50')).toBeInTheDocument();
  });

  it('renders period suffix when provided', () => {
    render(<Price amount="4500.00" period="night" />);
    expect(screen.getByText('₹4,500.00')).toBeInTheDocument();
    expect(screen.getByText('/ night')).toBeInTheDocument();
  });

  it('applies custom size classes', () => {
    const { container } = render(<Price amount="250.00" size="xl" />);
    expect(container.firstChild).toHaveClass('text-2xl');
  });
});
