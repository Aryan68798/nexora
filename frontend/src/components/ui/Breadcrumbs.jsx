import React from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Breadcrumbs item definition
 * @typedef {Object} BreadcrumbItem
 * @property {string} label - Display label
 * @property {string} [href] - Link target
 * @property {() => void} [onClick] - Click handler
 */

/**
 * Accessible Breadcrumbs component
 * @param {Object} props
 * @param {BreadcrumbItem[]} props.items - List of breadcrumb items
 * @param {string} [props.className] - Additional classes
 */
export function Breadcrumbs({ items, className = '' }) {
  if (!items || items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center text-sm', className)}>
      <ol className="flex items-center flex-wrap gap-1.5 text-body">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={index} className="flex items-center">
              {index > 0 && (
                <ChevronRight
                  className="w-4 h-4 text-body/50 mx-1 flex-shrink-0"
                  aria-hidden="true"
                />
              )}
              {isLast ? (
                <span
                  className="font-medium text-ink truncate max-w-[200px] sm:max-w-xs"
                  aria-current="page"
                >
                  {item.label}
                </span>
              ) : item.href ? (
                <a
                  href={item.href}
                  onClick={(e) => {
                    if (item.onClick) {
                      e.preventDefault();
                      item.onClick();
                    }
                  }}
                  className="hover:text-primary-hover transition-colors focus-ring rounded"
                >
                  {item.label}
                </a>
              ) : (
                <button
                  type="button"
                  onClick={item.onClick}
                  className="hover:text-primary-hover transition-colors focus-ring rounded text-left"
                >
                  {item.label}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
