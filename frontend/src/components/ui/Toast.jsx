import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '../../lib/utils';

const ToastContext = createContext(null);

/**
 * Toast notification system with auto-dismiss and aria-live announcements.
 * Usage:
 *   const { toast } = useToast();
 *   toast.success('Property created successfully');
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, options = {}) => {
    const id = Math.random().toString(36).slice(2, 9);
    const duration = options.duration || 4500;
    const type = options.type || 'info'; // 'success' | 'error' | 'warning' | 'info'

    const newToast = { id, message, type, ...options };
    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
  }, [removeToast]);

  const toast = (msgOrOpts, maybeOpts) => {
    if (typeof msgOrOpts === 'object' && msgOrOpts !== null) {
      const type = msgOrOpts.variant === 'danger' ? 'error' : msgOrOpts.variant || 'info';
      const msg = msgOrOpts.description ? `${msgOrOpts.title ? msgOrOpts.title + ': ' : ''}${msgOrOpts.description}` : msgOrOpts.title || '';
      addToast(msg, { ...msgOrOpts, type });
    } else {
      addToast(msgOrOpts, maybeOpts);
    }
  };

  toast.show = (msg, opts) => addToast(msg, opts);
  toast.success = (msg, opts) => addToast(msg, { ...opts, type: 'success' });
  toast.error = (msg, opts) => addToast(msg, { ...opts, type: 'error' });
  toast.warning = (msg, opts) => addToast(msg, { ...opts, type: 'warning' });
  toast.info = (msg, opts) => addToast(msg, { ...opts, type: 'info' });

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-success shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-danger shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-warning shrink-0" />,
    info: <Info className="w-5 h-5 text-primary shrink-0" />,
  };

  const borderStyles = {
    success: 'border-success/30 bg-card',
    error: 'border-danger/30 bg-card',
    warning: 'border-warning/30 bg-card',
    info: 'border-border bg-card',
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast viewport */}
      <div
        aria-live="polite"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-warm-lg bg-card text-ink',
                borderStyles[t.type]
              )}
            >
              {icons[t.type]}
              <div className="flex-1 text-sm font-medium leading-snug pt-0.5">
                {t.message}
              </div>
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action.onClick?.();
                    removeToast(t.id);
                  }}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-sand border border-border text-primary hover:text-primary-hover hover:border-primary transition-colors focus-ring shrink-0"
                >
                  {t.action.label || 'Undo'}
                </button>
              )}
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="p-1 -mr-1 -mt-1 text-body/60 hover:text-ink rounded-lg focus-ring"
                aria-label="Close notification"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    const noopFn = () => {};
    noopFn.show = () => {};
    noopFn.success = () => {};
    noopFn.error = () => {};
    noopFn.warning = () => {};
    noopFn.info = () => {};
    return {
      toast: noopFn,
      addToast: () => {},
      removeToast: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
      warning: () => {},
      show: () => {},
    };
  }
  return context;
}
