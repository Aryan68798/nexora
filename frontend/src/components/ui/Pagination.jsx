import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Pagination component with accessible keyboard navigation and min 44px tap targets
 * @param {Object} props
 * @param {number} props.currentPage - Current active page (1-based)
 * @param {number} props.totalPages - Total pages
 * @param {(page: number) => void} props.onPageChange - Page change handler
 * @param {string} [props.className] - Additional classes
 */
export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className = '',
}) {
  if (totalPages <= 1) return null;

  // Build page numbers with ellipsis
  const getPageNumbers = () => {
    const pages = [];
    const showMax = 5;

    if (totalPages <= showMax) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      if (start > 2) pages.push('ellipsis-1');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push('ellipsis-2');

      pages.push(totalPages);
    }
    return pages;
  };

  const pages = getPageNumbers();

  return (
    <nav
      role="navigation"
      aria-label="Pagination Navigation"
      className={cn('flex items-center justify-center gap-1.5 sm:gap-2 select-none', className)}
    >
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="Go to previous page"
        className={cn(
          'min-w-[44px] min-h-[44px] px-3 rounded-lg flex items-center justify-center',
          'text-sm font-medium transition-colors focus-ring',
          currentPage <= 1
            ? 'text-body/40 cursor-not-allowed opacity-50'
            : 'text-body hover:bg-sand hover:text-ink active:scale-95'
        )}
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        <span className="hidden sm:inline">Prev</span>
      </button>

      <div className="flex items-center gap-1">
        {pages.map((p, idx) => {
          if (typeof p === 'string') {
            return (
              <span
                key={`ellipsis-${idx}`}
                className="w-8 text-center text-body/50 font-bold select-none"
                aria-hidden="true"
              >
                ...
              </span>
            );
          }

          const isActive = p === currentPage;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-label={`Page ${p}`}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'min-w-[44px] min-h-[44px] px-3.5 rounded-lg flex items-center justify-center',
                'text-sm font-medium transition-all focus-ring',
                isActive
                  ? 'bg-primary text-white font-semibold shadow-warm-xs'
                  : 'text-body hover:bg-sand hover:text-ink'
              )}
            >
              {p}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        aria-label="Go to next page"
        className={cn(
          'min-w-[44px] min-h-[44px] px-3 rounded-lg flex items-center justify-center',
          'text-sm font-medium transition-colors focus-ring',
          currentPage >= totalPages
            ? 'text-body/40 cursor-not-allowed opacity-50'
            : 'text-body hover:bg-sand hover:text-ink active:scale-95'
        )}
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRight className="w-4 h-4 ml-1" />
      </button>
    </nav>
  );
}
