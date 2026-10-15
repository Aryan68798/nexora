import React from 'react';
import { BottomSheet } from '../native/BottomSheet';
import { Button } from '../ui/Button';
import { AlertCircle, Trash2, CheckCircle2 } from 'lucide-react';

/**
 * ConfirmSheet: Accessible confirmation dialog that opens as a BottomSheet
 * with 44px minimum touch targets and safe area padding.
 */
export function ConfirmSheet({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary', // 'primary' | 'danger' | 'warning'
  isLoading = false,
  error = null,
}) {
  const getIcon = () => {
    switch (variant) {
      case 'danger':
        return <Trash2 className="w-5 h-5 text-danger" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-warning" />;
      default:
        return <CheckCircle2 className="w-5 h-5 text-primary" />;
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={title}>
      <div className="py-2 space-y-4">
        {description && (
          <div className="flex items-start gap-3 text-body text-sm leading-relaxed">
            <div className="shrink-0 mt-0.5">{getIcon()}</div>
            <div className="space-y-2">
              <p>{description}</p>
              {error && (
                <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs font-medium">
                  {error}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
            className="w-full sm:w-auto min-h-[44px]"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            isLoading={isLoading}
            className="w-full sm:w-auto min-h-[44px]"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
