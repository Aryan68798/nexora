import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Step definition
 * @typedef {Object} Step
 * @property {string} title - Step title
 * @property {string} [description] - Optional subtext
 */

/**
 * Stepper component for multi-step workflows (e.g. role signup, booking checkout)
 * @param {Object} props
 * @param {Step[]} props.steps - List of step definitions
 * @param {number} props.currentStep - Current active step index (0-based)
 * @param {(index: number) => void} [props.onStepClick] - Optional click handler for completed steps
 * @param {string} [props.className] - Additional classes
 */
export function Stepper({
  steps,
  currentStep,
  onStepClick,
  className = '',
}) {
  return (
    <div className={cn('w-full py-2', className)}>
      <ol className="flex items-center w-full justify-between" role="list">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isActive = index === currentStep;
          const isPending = index > currentStep;
          const isClickable = isCompleted && onStepClick;

          return (
            <li
              key={index}
              className={cn(
                'relative flex flex-col items-center flex-1',
                index !== steps.length - 1 && 'after:content-[""] after:w-full after:h-0.5 after:top-4 after:left-1/2 after:absolute after:-translate-y-1/2',
                index !== steps.length - 1 && (isCompleted ? 'after:bg-primary' : 'after:bg-border')
              )}
            >
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onStepClick(index)}
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  'relative z-10 w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm transition-all focus-ring',
                  isCompleted && 'bg-primary text-white shadow-warm-xs',
                  isActive && 'border-2 border-primary bg-card text-primary-hover shadow-warm-sm ring-4 ring-primary/10',
                  isPending && 'bg-sand border border-border text-body/70',
                  !isClickable && 'cursor-default'
                )}
              >
                {isCompleted ? (
                  <Check className="w-4 h-4 stroke-[2.5]" aria-hidden="true" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </button>

              <div className="mt-2 text-center">
                <span
                  className={cn(
                    'block text-xs md:text-sm font-medium transition-colors',
                    isActive ? 'text-ink font-semibold' : isCompleted ? 'text-ink' : 'text-body/60'
                  )}
                >
                  {step.title}
                </span>
                {step.description && (
                  <span className="hidden md:block text-2xs text-body mt-0.5">
                    {step.description}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
