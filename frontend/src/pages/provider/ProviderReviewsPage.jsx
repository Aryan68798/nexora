import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Star,
  RotateCcw,
} from 'lucide-react';
import { api } from '../../api/client';
import { cn } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { CollapsingTitle } from '../../components/native/CollapsingTitle';

export function ProviderReviewsPage() {
  // Fetch provider's own profile and stats
  const {
    data: profileData,
    isLoading: isProfileLoading,
    isError: isProfileError,
    error: profileError,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ['my-provider-profile'],
    queryFn: async () => {
      const res = await api.get('/api/providers/me');
      return res.data || res;
    },
  });

  const provider = profileData || {};
  const stats = provider.stats || {};
  const isLoading = isProfileLoading;

  return (
    <div className="space-y-6 pb-12">
      {/* Title */}
      <CollapsingTitle
        title="Client Reviews & Ratings"
        subtitle="Reputation metrics and verified feedback from property owners across completed work orders."
      />

      {/* Summary Scorecards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-6 rounded-2xl bg-card border border-border shadow-warm-xs space-y-1">
          <span className="text-xs font-medium text-body uppercase tracking-wider block">
            Average Rating
          </span>
          <div className="flex items-center gap-2">
            <span className="text-3xl font-bold font-sans text-ink">
              {stats.averageRating ? Number(stats.averageRating).toFixed(1) : '5.0'}
            </span>
            <div className="flex items-center gap-0.5 text-amber">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={cn(
                    'w-4 h-4',
                    (stats.averageRating || 5) >= s ? 'fill-current' : 'text-border'
                  )}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-card border border-border shadow-warm-xs space-y-1">
          <span className="text-xs font-medium text-body uppercase tracking-wider block">
            Verified Reviews
          </span>
          <div className="text-3xl font-bold font-sans text-ink">
            {stats.reviewCount || 0}
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-card border border-border shadow-warm-xs space-y-1">
          <span className="text-xs font-medium text-body uppercase tracking-wider block">
            Completed Work Orders
          </span>
          <div className="text-3xl font-bold font-sans text-ink">
            {stats.completedJobCount || 0}
          </div>
        </div>
      </div>

      {/* Reviews List & History */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-28 rounded-2xl bg-sand/40 animate-pulse border border-border/50" />
          ))}
        </div>
      ) : isProfileError ? (
        <div className="p-8 rounded-2xl bg-danger/10 border border-danger/30 text-center space-y-3">
          <p className="font-semibold text-danger">
            {profileError?.message || 'Unable to load provider profile.'}
          </p>
          <Button variant="secondary" size="sm" onClick={() => refetchProfile()} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            <span>Try Again</span>
          </Button>
        </div>
      ) : (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card space-y-3">
          <div className="w-12 h-12 rounded-xl bg-sand/60 text-body flex items-center justify-center mx-auto">
            <Star className="w-6 h-6 text-amber" />
          </div>
          <h3 className="font-sans font-semibold text-ink text-base">Detailed Review History</h3>
          <p className="text-body text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
            Detailed client review listings are not available yet for provider accounts. Your aggregate rating and total verified review counts are summarized above directly from verified completions.
          </p>
        </div>
      )}
    </div>
  );
}

