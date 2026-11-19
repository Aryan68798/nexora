import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BottomSheet } from '../components/native/BottomSheet';
import { ContextMenu } from '../components/native/ContextMenu';
import { SwipeRow } from '../components/native/SwipeRow';
import { haptics, isHapticsEnabled, setHapticsEnabled } from '../lib/haptics';
import { useMotionPreference } from '../lib/motion';

describe('Native Components & Foundations - Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Haptics Module', () => {
    it('does not throw when navigator.vibrate is undefined (e.g. iOS Safari)', () => {
      const originalVibrate = navigator.vibrate;
      delete navigator.vibrate;

      expect(() => {
        haptics.light();
        haptics.medium();
        haptics.success();
        haptics.warning();
      }).not.toThrow();

      navigator.vibrate = originalVibrate;
    });

    it('triggers navigator.vibrate with correct pattern when enabled', () => {
      const mockVibrate = vi.fn();
      navigator.vibrate = mockVibrate;

      setHapticsEnabled(true);
      expect(isHapticsEnabled()).toBe(true);

      haptics.light();
      expect(mockVibrate).toHaveBeenCalledWith(10);

      haptics.medium();
      expect(mockVibrate).toHaveBeenCalledWith(25);

      haptics.success();
      expect(mockVibrate).toHaveBeenCalledWith([12, 40, 12]);

      haptics.warning();
      expect(mockVibrate).toHaveBeenCalledWith([20, 60, 20]);
    });

    it('respects user toggle when disabled via setHapticsEnabled', () => {
      const mockVibrate = vi.fn();
      navigator.vibrate = mockVibrate;

      setHapticsEnabled(false);
      expect(isHapticsEnabled()).toBe(false);

      haptics.light();
      haptics.medium();
      haptics.success();
      haptics.warning();

      expect(mockVibrate).not.toHaveBeenCalled();
    });
  });

  describe('useMotionPreference Hook', () => {
    function TestMotionComponent() {
      const prefersReduced = useMotionPreference();
      return <div data-testid="motion-pref">{prefersReduced ? 'reduced' : 'full'}</div>;
    }

    it('renders reduced motion status correctly', () => {
      render(<TestMotionComponent />);
      expect(screen.getByTestId('motion-pref')).toBeInTheDocument();
    });
  });

  describe('BottomSheet Component', () => {
    function TestSheet({ isOpen: initialOpen = true, onClose = vi.fn() }) {
      const [isOpen, setIsOpen] = useState(initialOpen);
      return (
        <BottomSheet
          isOpen={isOpen}
          onClose={() => {
            setIsOpen(false);
            onClose();
          }}
          title="Sheet Title"
        >
          <div data-testid="sheet-content">
            <p>Inner content</p>
            <button type="button" onClick={() => setIsOpen(false)}>
              Close inside
            </button>
          </div>
        </BottomSheet>
      );
    }

    it('renders title, content and dialog role when open', () => {
      render(<TestSheet isOpen={true} />);
      expect(screen.getByRole('dialog', { name: 'Sheet Title' })).toBeInTheDocument();
      expect(screen.getByText('Inner content')).toBeInTheDocument();
    });

    it('closes on Escape key press', () => {
      const handleClose = vi.fn();
      render(<TestSheet isOpen={true} onClose={handleClose} />);

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalled();
    });

    it('closes when clicking close icon button', () => {
      const handleClose = vi.fn();
      render(<TestSheet isOpen={true} onClose={handleClose} />);

      const closeBtn = screen.getByRole('button', { name: 'Close sheet' });
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalled();
    });

    it('closes when clicking the backdrop scrim', () => {
      const handleClose = vi.fn();
      render(<TestSheet isOpen={true} onClose={handleClose} />);

      const scrim = screen.getByTestId('sheet-scrim');
      fireEvent.click(scrim);
      expect(handleClose).toHaveBeenCalled();
    });
  });

  describe('ContextMenu Component', () => {
    const mockAction = vi.fn();
    const items = [
      { label: 'Action One', onClick: mockAction },
      { label: 'Action Two', destructive: true, onClick: vi.fn() },
    ];

    it('renders children and visible trigger button', () => {
      render(
        <ContextMenu items={items} buttonLabel="Card options">
          <div data-testid="card-child">Child Element</div>
        </ContextMenu>
      );

      expect(screen.getByTestId('card-child')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Card options' })).toBeInTheDocument();
    });

    it('opens menu when clicking the visible trigger button and handles item click', () => {
      render(
        <ContextMenu items={items} buttonLabel="Card options">
          <div>Target</div>
        </ContextMenu>
      );

      const triggerBtn = screen.getByRole('button', { name: 'Card options' });
      fireEvent.click(triggerBtn);

      const menuItem = screen.getByRole('menuitem', { name: 'Action One' });
      expect(menuItem).toBeInTheDocument();

      fireEvent.click(menuItem);
      expect(mockAction).toHaveBeenCalled();
    });

    it('opens menu on right-click contextmenu event', () => {
      render(
        <ContextMenu items={items} buttonLabel="Card options">
          <div data-testid="right-click-target">Right click me</div>
        </ContextMenu>
      );

      const target = screen.getByTestId('right-click-target');
      fireEvent.contextMenu(target, { clientX: 100, clientY: 150 });

      expect(screen.getByRole('menuitem', { name: 'Action One' })).toBeInTheDocument();
    });
  });

  describe('SwipeRow Component', () => {
    it('renders children and handles action click', () => {
      const handleAction = vi.fn();

      render(
        <SwipeRow
          onAction={handleAction}
          actionLabel="Remove item"
          actionVariant="danger"
        >
          <div data-testid="row-child">Row Content</div>
        </SwipeRow>
      );

      expect(screen.getByTestId('row-child')).toBeInTheDocument();
      const actionButton = screen.getByText('Remove item');
      expect(actionButton).toBeInTheDocument();

      fireEvent.click(actionButton);
      expect(handleAction).toHaveBeenCalled();
    });
  });
});
