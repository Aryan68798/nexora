import React, { useState, useRef } from 'react';
import { Images } from 'lucide-react';
import { Lightbox } from './Lightbox';
import { PlaceholderImage } from '../ui/PlaceholderImage';
import { cn } from '../../lib/utils';

/**
 * Editorial Photo Gallery for Space Detail Page.
 *
 * Desktop layout: ONE main image at 3:2 ratio + single row of equal thumbnails
 *   below (up to 6 visible; last thumbnail shows "+N more" button if there are more).
 * Mobile layout: horizontal scroll-snap strip with counter "1 / N" overlay;
 *   tap any image to open the full-screen Lightbox.
 *
 * No photos: plain sand placeholder at the same 3:2 ratio.
 * No mosaic / bento grid. No col-span. No row-span.
 */
export function SpaceGallery({
  media = [],
  spaceType = 'OTHER',
  spaceName = 'Space',
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [mobileIndex, setMobileIndex] = useState(0);
  const stripRef = useRef(null);

  const rawImages = Array.isArray(media) ? media : [];
  // Sort: cover image first, then by sort_order
  const images = [...rawImages].sort((a, b) => {
    const aCover = Boolean(a.is_cover ?? a.isCover);
    const bCover = Boolean(b.is_cover ?? b.isCover);
    if (aCover && !bCover) return -1;
    if (!aCover && bCover) return 1;
    const aOrder = Number(a.sort_order ?? a.sortOrder ?? 0);
    const bOrder = Number(b.sort_order ?? b.sortOrder ?? 0);
    return aOrder - bOrder;
  });

  const hasImages = images.length > 0;
  const total = images.length;
  // Show up to 6 thumbnails on desktop; show "+N" on the last slot if there are more
  const MAX_THUMBS = 6;

  const openLightbox = (index) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // Update the mobile counter based on scroll position
  const handleStripScroll = () => {
    const el = stripRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setMobileIndex(Math.max(0, Math.min(idx, total - 1)));
  };

  // ── NO PHOTOS ─────────────────────────────────────────────────────────────
  if (!hasImages) {
    return (
      <div
        className="rounded-xl overflow-hidden border border-border bg-sand"
        style={{ aspectRatio: '3/2' }}
        role="img"
        aria-label={`No photos available for ${spaceName}`}
      >
        <PlaceholderImage
          spaceType={spaceType}
          title={spaceName}
          className="w-full h-full"
          aspectRatio="3/2"
        />
      </div>
    );
  }

  // ── SINGLE PHOTO ──────────────────────────────────────────────────────────
  if (total === 1) {
    return (
      <div className="rounded-xl overflow-hidden border border-border">
        <button
          type="button"
          onClick={() => openLightbox(0)}
          className="block w-full focus-ring"
          aria-label={`View photo of ${spaceName}`}
          style={{ aspectRatio: '3/2' }}
        >
          <img
            src={images[0].url}
            alt={images[0].caption || spaceName}
            className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-500 ease-out"
          />
        </button>
        <Lightbox
          images={images}
          currentIndex={lightboxIndex}
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          onNavigate={setLightboxIndex}
        />
      </div>
    );
  }

  // ── MULTIPLE PHOTOS ───────────────────────────────────────────────────────
  const thumbImages = images.slice(1, MAX_THUMBS + 1);
  const extraCount = total - 1 - thumbImages.length; // images beyond what we show

  return (
    <div className="space-y-2">
      {/* ── MOBILE: horizontal scroll-snap strip ── */}
      <div className="relative md:hidden rounded-xl overflow-hidden border border-border">
        <div
          ref={stripRef}
          onScroll={handleStripScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none"
          style={{ scrollbarWidth: 'none' }}
          aria-label={`Photos of ${spaceName}`}
        >
          {images.map((img, idx) => (
            <button
              key={img.id || idx}
              type="button"
              onClick={() => openLightbox(idx)}
              className="shrink-0 w-full snap-start focus-ring block"
              aria-label={`Photo ${idx + 1} of ${total}: ${img.caption || spaceName}`}
              style={{ aspectRatio: '3/2' }}
            >
              <img
                src={img.url}
                alt=""
                className="w-full h-full object-cover"
                loading={idx === 0 ? 'eager' : 'lazy'}
              />
            </button>
          ))}
        </div>

        {/* Counter badge */}
        <div
          className="absolute bottom-3 right-3 px-2.5 py-1 rounded-xl bg-ink/70 text-white text-xs font-medium tabular-nums pointer-events-none"
          aria-live="polite"
          aria-atomic="true"
        >
          {mobileIndex + 1} / {total}
        </div>
      </div>

      {/* ── DESKTOP: main image + thumbnail row ── */}
      <div className="hidden md:block">
        {/* Main image at 3:2 */}
        <button
          type="button"
          onClick={() => openLightbox(0)}
          className="block w-full rounded-xl overflow-hidden border border-border focus-ring group"
          aria-label={`View primary photo of ${spaceName}`}
          style={{ aspectRatio: '3/2' }}
        >
          <img
            src={images[0].url}
            alt={images[0].caption || `${spaceName} main photo`}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500 ease-out"
          />
        </button>

        {/* Thumbnail row: equal widths, equal heights, up to 6 */}
        {thumbImages.length > 0 && (
          <div className={cn(
            'grid gap-2 mt-2',
            thumbImages.length === 1 && 'grid-cols-1',
            thumbImages.length === 2 && 'grid-cols-2',
            thumbImages.length === 3 && 'grid-cols-3',
            thumbImages.length === 4 && 'grid-cols-4',
            thumbImages.length === 5 && 'grid-cols-5',
            thumbImages.length >= 6 && 'grid-cols-6',
          )}>
            {thumbImages.map((img, i) => {
              const realIdx = i + 1; // index in full images array
              const isLastSlot = i === thumbImages.length - 1 && extraCount > 0;

              return (
                <button
                  key={img.id || realIdx}
                  type="button"
                  onClick={() => openLightbox(realIdx)}
                  className="relative block rounded-xl overflow-hidden border border-border focus-ring group"
                  aria-label={
                    isLastSlot
                      ? `View all ${total} photos of ${spaceName}`
                      : `View photo ${realIdx + 1} of ${spaceName}`
                  }
                  style={{ aspectRatio: '3/2' }}
                >
                  <img
                    src={img.url}
                    alt={img.caption || `${spaceName} photo ${realIdx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
                    loading="lazy"
                  />

                  {/* "+N more" overlay on last thumbnail */}
                  {isLastSlot && (
                    <div className="absolute inset-0 bg-ink/50 flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">+{extraCount + 1}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* "Show all photos" link below */}
        {total > 1 && (
          <button
            type="button"
            onClick={() => openLightbox(0)}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-hover focus-ring rounded-lg py-1 transition-colors"
          >
            <Images className="w-3.5 h-3.5" />
            <span>Show all {total} photos</span>
          </button>
        )}
      </div>

      {/* Shared Lightbox */}
      <Lightbox
        images={images}
        currentIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={setLightboxIndex}
      />
    </div>
  );
}
