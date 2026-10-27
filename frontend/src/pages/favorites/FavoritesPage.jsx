import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, ArrowRight, RefreshCw, Trash2 } from 'lucide-react';
import { api } from '../../api/client';
import { SpaceCard } from '../../components/spaces/SpaceCard';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Pagination } from '../../components/ui/Pagination';
import { useToast } from '../../components/ui/Toast';
import { SwipeRow } from '../../components/native/SwipeRow';
import { CollapsingTitle } from '../../components/native/CollapsingTitle';
import { cn } from '../../lib/utils';

export function FavoritesPage() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['favorites', { page }],
    queryFn: () => api.get('/api/favorites', { params: { page, pageSize: 9 } }),
    staleTime: 30 * 1000,
  });

  const rawItems = data?.data || (Array.isArray(data) ? data : []);
  const meta = data?.meta || { page, pageSize: 9, total: rawItems.length, totalPages: 1 };

  // Local state to support immediate optimistic exit animation and undo
  const [removedIds, setRemovedIds] = useState(new Set());

  // Filter out removed items from display
  const displayedItems = rawItems.filter((item) => !removedIds.has(item.id));

  const handleFavoriteChange = async (spaceId, nextState) => {
    // If nextState is false, the user just unfavorited this space
    if (!nextState) {
      const targetSpace = rawItems.find((s) => s.id === spaceId);
      if (!targetSpace) return;

      // Mark removed locally for exit animation
      setRemovedIds((prev) => new Set([...prev, spaceId]));

      // Setup undo handler
      const handleUndo = async () => {
        // Restore to displayed items
        setRemovedIds((prev) => {
          const next = new Set(prev);
          next.delete(spaceId);
          return next;
        });

        try {
          await api.put(`/api/favorites/${spaceId}`);
          toast.success(`Restored "${targetSpace.name}" to favorites`);
          queryClient.invalidateQueries({ queryKey: ['favorites'] });
        } catch {
          toast.error('Failed to restore favorite');
        }
      };

      toast.show(`Removed "${targetSpace.name}" from favorites`, {
        duration: 5000,
        action: {
          label: 'Undo',
          onClick: handleUndo,
        },
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header with CollapsingTitle */}
      <CollapsingTitle
        title="Saved spaces"
        subtitle="Your personal treasury of architectural rooms, studios, and slow-living retreats across India."
        actions={
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card hover:bg-sand text-xs font-semibold uppercase tracking-wider text-body hover:text-ink transition-colors focus-ring"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
            <span>Refresh</span>
          </button>
        }
      />

      {/* Main Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="rounded-3xl bg-card border border-border p-3 space-y-3">
              <Skeleton className="w-full h-48 rounded-2xl" />
              <Skeleton className="w-3/4 h-5 rounded-md" />
              <Skeleton className="w-1/2 h-4 rounded-md" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="Unable to load favorites"
          message={error?.message || 'A network error occurred while retrieving your saved spaces.'}
          onRetry={refetch}
        />
      ) : displayedItems.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="No saved spaces yet"
          description="Browse spaces on the marketplace and tap the heart icon to save listings."
          actionLabel="Browse spaces"
          onAction={() => {}}
        >
          <Link
            to="/#spaces"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold tracking-wider uppercase hover:bg-primary-hover shadow-warm-xs transition-all focus-ring"
          >
            <span>Browse spaces</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </EmptyState>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {displayedItems.map((space) => (
                <motion.div
                  key={space.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                >
                  <SwipeRow
                    onAction={() => handleFavoriteChange(space.id, false)}
                    actionLabel="Remove"
                    actionIcon={<Trash2 className="w-4 h-4" />}
                    actionVariant="danger"
                  >
                    <SpaceCard
                      space={{ ...space, isFavorite: true }}
                      onFavoriteChange={handleFavoriteChange}
                    />
                  </SwipeRow>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {meta.totalPages > 1 && (
            <Pagination
              currentPage={meta.page}
              totalPages={meta.totalPages}
              onPageChange={(newPage) => {
                setPage(newPage);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
