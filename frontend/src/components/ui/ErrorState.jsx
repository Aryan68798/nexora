import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

/**
 * ErrorState component for failure recovery
 * @param {Object} props
 * @param {string} [props.title] - Error heading
 * @param {string} [props.message] - Error explanation
 * @param {() => void} [props.onRetry] - Retry callback
 * @param {string} [props.retryLabel] - Label for retry button
 * @param {string} [props.className] - Additional classes
 */
export function ErrorState({
  title = 'Something went wrong',
  message = 'We encountered an error loading this information. Please try again.',
  onRetry,
  retryLabel = 'Try again',
  className = '',
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-8 md:p-12',
        'rounded-2xl border border-danger/30 bg-danger/10 text-ink',
        className
      )}
      role="alert"
    >
      <div className="w-14 h-14 rounded-full bg-danger/20 flex items-center justify-center text-danger mb-4 shadow-warm-xs">
        <AlertCircle className="w-7 h-7" aria-hidden="true" />
      </div>

      <h3 className="font-serif text-xl md:text-2xl font-bold text-ink mb-2">
        {title}
      </h3>

      <p className="text-body text-sm md:text-base max-w-md mb-6 leading-relaxed">
        {message}
      </p>

      {onRetry && (
        <Button
          variant="secondary"
          onClick={onRetry}
          leftIcon={<RotateCcw className="w-4 h-4" />}
          className="border-danger/30 hover:bg-danger/10 text-danger"
        >
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
