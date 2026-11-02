import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

/**
 * Pre-configured confirmation modal for destructive or significant actions.
 * Usage:
 *   <ConfirmDialog
 *     isOpen={isConfirmOpen}
 *     onClose={() => setIsConfirmOpen(false)}
 *     onConfirm={handleDelete}
 *     title="Cancel Booking"
 *     message="Are you sure you want to cancel this booking? This action cannot be undone."
 *     confirmText="Yes, Cancel"
 *     danger
 *   />
 */
export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  message = 'Please confirm this action to proceed.',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  isLoading = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div className="flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-full bg-danger-50 text-danger-600 flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-xl font-semibold text-ink">{title}</h3>
        <p className="text-sm text-body mt-2 mb-6">{message}</p>

        <div className="flex items-center gap-3 w-full">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1"
          >
            {cancelText}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            isLoading={isLoading}
            className="flex-1"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
