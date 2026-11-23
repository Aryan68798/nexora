import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, MapPin, Users, Star, Share2, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../features/auth/useAuth';
import { api } from '../../api/client';
import { Img } from '../ui/Img';
import { Price } from '../ui/Price';
import { useToast } from '../ui/Toast';
import { ContextMenu } from '../native/ContextMenu';
import { cn } from '../../lib/utils';

/**
 * Editorial Space Card for Home Page featured grid and /explore search results.
 * Features optimistic favorite toggle with rollback, hover image zoom, and guest redirect to login.
 */
export function SpaceCard({
  space,
  aspectRatio = '4/3',
  featured: _featured = false,
  className = '',
  onFavoriteChange,
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAuthenticated, role } = useAuth();
  const [isFavorite, setIsFavorite] = useState(Boolean(space?.isFavorite));
  const [isUpdatingFavorite, setIsUpdatingFavorite] = useState(false);

  if (!space) return null;

  const handleFavoriteClick = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Guests and non-customers are sent to login
    if (!isAuthenticated || role !== 'CUSTOMER') {
      navigate('/login');
      return;
    }

    if (isUpdatingFavorite) return;

    const previousState = isFavorite;
    const nextState = !previousState;
    // Optimistic UI update
    setIsFavorite(nextState);
    setIsUpdatingFavorite(true);

    try {
      if (nextState) {
        await api.put(`/api/favorites/${space.id}`);
      } else {
        await api.delete(`/api/favorites/${space.id}`);
      }
      if (onFavoriteChange) {
        onFavoriteChange(space.id, nextState);
      }
    } catch {
      // Rollback on failure
      setIsFavorite(previousState);
    } finally {
      setIsUpdatingFavorite(false);
    }
  };

  const city = space?.property?.city || space?.city || '';
  const state = space.property?.state || space.state || '';
  const locationLabel = [city, state].filter(Boolean).join(', ');

  const contextMenuItems = [
    {
      label: 'Open space',
      icon: ExternalLink,
      onClick: () => navigate(`/spaces/${space.id}`),
    },
    {
      label: isFavorite ? 'Remove from favorites' : 'Save to favorites',
      icon: Heart,
      onClick: handleFavoriteClick,
    },
    {
      label: 'Share space link',
      icon: Share2,
      onClick: () => {
        navigator.clipboard.writeText(`${window.location.origin}/spaces/${space.id}`);
        toast.success('Link copied to clipboard');
      },
    },
  ];

  return (
    <ContextMenu
      items={contextMenuItems}
      buttonLabel={`Options for ${space.name}`}
      buttonClassName="top-3.5 right-16"
    >
      <article
        className={cn(
          'group relative flex flex-col rounded-3xl bg-card border border-border overflow-hidden transition-all duration-300 hover:shadow-warm-md',
          className
        )}
      >
        {/* Media Container with soft hover zoom */}
        <div className="relative w-full overflow-hidden bg-sand">
          <Link to={`/spaces/${space.id}`} className="block focus-ring">
            <Img
              src={space.coverImageUrl}
              alt={space.name}
              spaceType={space.spaceType}
              aspectRatio={aspectRatio}
              className="w-full"
              imgClassName="transition-transform duration-700 ease-out group-hover:scale-105"
            />
          </Link>

          {/* Favorite Heart Button */}
          <motion.button
            type="button"
            onClick={handleFavoriteClick}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            className={cn(
              'absolute top-3.5 right-3.5 w-10 h-10 rounded-xl flex items-center justify-center transition-colors focus-ring active:scale-95',
              isFavorite
                ? 'bg-card text-primary shadow-warm-sm'
                : 'bg-card/90 text-body hover:text-primary hover:bg-card shadow-warm-xs'
            )}
            whileTap={{ scale: 0.85 }}
            animate={{ scale: isFavorite ? [1, 1.25, 1] : 1 }}
            transition={{ duration: 0.25 }}
          >
            <Heart
              className={cn(
                'w-5 h-5 transition-colors',
                isFavorite ? 'fill-primary stroke-primary' : 'stroke-current'
              )}
            />
          </motion.button>
        </div>

      {/* Content Details */}
      <div className="flex flex-col flex-1 p-5 sm:p-6 justify-between gap-4">
        <div className="space-y-1.5">
          {/* Space Type & Rating Header */}
          <div className="flex items-center justify-between text-xs gap-2">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-primary">
              {space.spaceType ? space.spaceType.replace(/_/g, ' ') : 'Workspace'}
            </span>

            {/* Rating */}
            <div className="flex items-center gap-1 shrink-0 font-medium text-ink">
              <Star className="w-3.5 h-3.5 fill-amber text-amber" />
              <span>{space.averageRating ? Number(space.averageRating).toFixed(1) : 'New'}</span>
              {space.reviewCount > 0 && (
                <span className="text-body font-normal">({space.reviewCount})</span>
              )}
            </div>
          </div>

          {/* Location */}
          {locationLabel && (
            <p className="flex items-center gap-1 text-xs text-body truncate" title={locationLabel}>
              <MapPin className="w-3.5 h-3.5 text-body/70 shrink-0" />
              <span className="truncate">{locationLabel}</span>
            </p>
          )}

          {/* Title */}
          <h3 className="font-serif text-lg sm:text-xl font-semibold text-ink line-clamp-1 transition-colors group-hover:text-primary">
            <Link to={`/spaces/${space.id}`} className="focus-ring rounded">
              {space.name}
            </Link>
          </h3>

          {/* Capacity attribute if present */}
          {space.capacity && (
            <p className="text-xs text-body flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-body/80" />
              <span>Up to {space.capacity} guests</span>
            </p>
          )}
        </div>

        {/* Footer: Price per Unit */}
        <div className="pt-3 border-t border-border/70 flex items-baseline justify-between">
          <Price
            amount={space.priceAmount}
            period={space.priceUnit ? space.priceUnit.toLowerCase() : 'night'}
            size="md"
          />

          <Link
            to={`/spaces/${space.id}`}
            className="text-xs font-semibold text-primary hover:text-primary-hover focus-ring rounded"
          >
            Details &rarr;
          </Link>
        </div>
      </div>
    </article>
  </ContextMenu>
  );
}

/**
 * Skeleton Loader for SpaceCard
 */
export function SpaceCardSkeleton({ aspectRatio = '4/3', className = '' }) {
  return (
    <div
      className={cn(
        'rounded-3xl bg-card border border-border overflow-hidden flex flex-col',
        className
      )}
    >
      <div className="w-full bg-sand skeleton-shimmer" style={{ aspectRatio }} />
      <div className="p-5 sm:p-6 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="h-3.5 w-24 bg-sand rounded-md skeleton-shimmer" />
          <div className="h-3.5 w-12 bg-sand rounded-md skeleton-shimmer" />
        </div>
        <div className="h-5 w-4/5 bg-sand rounded-md skeleton-shimmer" />
        <div className="h-3.5 w-1/3 bg-sand rounded-md skeleton-shimmer" />
        <div className="pt-3 border-t border-border flex justify-between items-center">
          <div className="h-5 w-20 bg-sand rounded-md skeleton-shimmer" />
          <div className="h-3.5 w-12 bg-sand rounded-md skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
}
