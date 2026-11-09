import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../components/ui/StatusBadge';

describe('StatusBadge Component', () => {
  it('renders booking statuses with friendly human labels', () => {
    const { rerender } = render(<StatusBadge status="PENDING" type="booking" />);
    expect(screen.getByText('Pending')).toBeInTheDocument();

    rerender(<StatusBadge status="CONFIRMED" type="booking" />);
    expect(screen.getByText('Confirmed')).toBeInTheDocument();

    rerender(<StatusBadge status="CHECKED_IN" type="booking" />);
    expect(screen.getByText('Checked In')).toBeInTheDocument();

    rerender(<StatusBadge status="CANCELLED" type="booking" />);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('renders maintenance job statuses accurately', () => {
    const { rerender } = render(<StatusBadge status="OPEN" type="maintenance" />);
    expect(screen.getByText('Open')).toBeInTheDocument();

    rerender(<StatusBadge status="IN_PROGRESS" type="maintenance" />);
    expect(screen.getByText('In Progress')).toBeInTheDocument();

    rerender(<StatusBadge status="COMPLETED" type="maintenance" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('handles unknown status fallback gracefully', () => {
    render(<StatusBadge status="CUSTOM_STATUS" />);
    expect(screen.getByText('Custom Status')).toBeInTheDocument();
  });
});
