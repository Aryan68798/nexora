# Nexora Frontend Image Assets Guide

This directory documents the public image asset conventions used by the Nexora web application.

## 1. Hero Image
The homepage hero capsule image is loaded from:
```
frontend/public/images/hero.jpg
```
- **Recommended Aspect Ratio**: ~2.3:1 (e.g. 1920 × 835 px or 1600 × 700 px)
- **Format**: JPEG or WebP, optimized under 350 KB.
- **Graceful Fallback**: If `hero.jpg` is missing, the hero component automatically renders a warm, terracotta/sand layered SVG placeholder without layout shift or grey boxes.

## 2. Space Photos & Cover Images
In the database and API, spaces reference `coverImageUrl` (e.g. hosted on Supabase Storage).

Whenever a space has `coverImageUrl = null` or an image fails to load, the `<Img>` component renders `<PlaceholderImage>` with an architectural motif tailored to its `spaceType`:
- **ROOM / VILLA**: Classical arches, warm terracotta portal, courtyard sun.
- **OFFICE**: Modernist drafting grids, desk planes, amber study accents.
- **STUDIO**: Atelier natural light geometry, high diagonal vistas.
- **SHOP**: Colonnade arcade, awning rhythm, vitrine framing.
- **CLASSROOM**: Radiant amphitheater arcs, tiered acoustic lines.
- **PARKING**: Minimalist perspective ground planes, canopy geometry.
- **OTHER**: Organic topography contours with warm sun disc.

## 3. Uploading Real Space Photos
A separate administrative script or media upload flow via `POST /api/properties/:id/media` or `POST /api/spaces/:id/media` manages authenticated image binaries on Supabase Storage. The frontend handles both live image URLs and local mock assets seamlessly.
