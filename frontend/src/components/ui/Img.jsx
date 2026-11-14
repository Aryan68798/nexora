import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { PlaceholderImage } from './PlaceholderImage';

/**
 * Image wrapper with lazy loading, layout-shift prevention, fade-in on load,
 * and graceful fallback to warm layered SVG placeholders.
 */
export function Img({
  src,
  alt = 'Space image',
  spaceType = 'OTHER',
  aspectRatio = '16/10',
  className = '',
  imgClassName = '',
  loading = 'lazy',
  ...props
}) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // If no source or failed to load, show graceful architectural placeholder
  if (!src || hasError) {
    return (
      <PlaceholderImage
        spaceType={spaceType}
        title={alt}
        aspectRatio={aspectRatio}
        className={className}
        {...props}
      />
    );
  }

  return (
    <div
      className={cn('relative w-full overflow-hidden bg-sand select-none', className)}
      style={{ aspectRatio }}
      {...props}
    >
      {/* Underlying placeholder while image buffers */}
      {!isLoaded && (
        <div className="absolute inset-0">
          <PlaceholderImage
            spaceType={spaceType}
            title={alt}
            aspectRatio={aspectRatio}
            className="w-full h-full"
          />
        </div>
      )}

      <img
        src={src}
        alt={alt}
        loading={loading}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        className={cn(
          'w-full h-full object-cover transition-all duration-500 ease-out',
          isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105',
          imgClassName
        )}
      />
    </div>
  );
}
