import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';

/**
 * 404 Not Found Page
 */
export function NotFoundPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center">
        {/* Architectural compass illustration */}
        <div className="w-24 h-24 rounded-2xl bg-sand border border-border flex items-center justify-center text-primary mx-auto mb-6 shadow-warm-xs">
          <Compass className="w-12 h-12 stroke-[1.5]" />
        </div>

        <p className="text-xs font-bold uppercase tracking-widest text-primary-hover mb-2">
          Error 404
        </p>

        <h1 className="font-serif text-3xl md:text-5xl font-bold text-ink mb-4">
          This space is uncharted
        </h1>

        <p className="text-body text-base md:text-lg mb-8 max-w-md mx-auto leading-relaxed">
          The page or space you are looking for has been retired, renamed, or never existed in this realm.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/">
            <Button variant="primary" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Return to Nexora
            </Button>
          </Link>
          <Link to="/#spaces">
            <Button variant="secondary">
              Browse spaces
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
