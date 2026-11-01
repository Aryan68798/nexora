import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

/**
 * Animated Tabs navigation using Framer Motion layoutId.
 * Usage:
 *   <Tabs
 *     tabs={[{ id: 'overview', label: 'Overview' }, { id: 'bookings', label: 'Bookings' }]}
 *     activeTab={currentTab}
 *     onChange={setCurrentTab}
 *   />
 */
export function Tabs({
  tabs = [],
  activeTab,
  onChange,
  className = '',
  layoutId = 'active-tab-indicator',
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex items-center gap-1 border-b border-border/80 overflow-x-auto scrollbar-none',
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative min-h-[44px] px-4 py-2.5 text-sm font-medium transition-colors focus-ring rounded-t-lg select-none whitespace-nowrap',
              isActive ? 'text-primary-hover font-semibold' : 'text-body hover:text-ink'
            )}
          >
            <span className="flex items-center gap-2">
              {tab.icon && <span className="w-4 h-4">{tab.icon}</span>}
              {tab.label}
              {tab.badge !== undefined && (
                <span className="ml-1 text-xs px-1.5 py-0.5 rounded-md bg-sand text-ink">
                  {tab.badge}
                </span>
              )}
            </span>

            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t"
                transition={{ type: 'spring', damping: 30, stiffness: 400 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
