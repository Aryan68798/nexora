import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';

/**
 * Coming Soon placeholder for routes scheduled for upcoming phases (F2, F3, F4, F5)
 * @param {Object} props
 * @param {string} props.phase - Phase identifier (e.g. 'Phase F2', 'Phase F3')
 * @param {string} props.title - Feature title
 * @param {string} props.description - Feature description
 */
export function ComingSoonPage({
  phase = 'Upcoming Phase',
  title = 'Under Construction',
  description = 'This feature is part of an upcoming release. The foundation and design system are prepared for its release.',
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card rounded-2xl p-8 md:p-10 shadow-warm-sm border border-border text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">
          {phase}
        </p>

        <h2 className="text-2xl md:text-3xl font-bold text-ink mb-3 tracking-tight">
          {title}
        </h2>

        <p className="text-body text-sm md:text-base leading-relaxed mb-8">
          {description}
        </p>

        <div className="flex items-center justify-center gap-3">
          <Link to="/">
            <Button variant="secondary" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
