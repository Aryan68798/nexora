import React, { useRef, useState } from 'react';
import {
  Upload,
  Camera,
  Trash2,
  Star,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';
import { normalizeMediaList } from '../../lib/mediaUtils';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_MEDIA_COUNT = 10;

/**
 * Validates a single file before adding it to the staging or upload list.
 * Returns { valid: true } or { valid: false, error: string }.
 */
export function validateImageFile(file, currentCount = 0) {
  if (currentCount >= MAX_MEDIA_COUNT) {
    return {
      valid: false,
      error: `Maximum limit of ${MAX_MEDIA_COUNT} photos reached. Remove an image to upload more.`,
    };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `"${file.name}" is not supported. Please upload JPEG, PNG, or WebP images only.`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeInMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `"${file.name}" is ${sizeInMB} MB. Maximum allowed file size is 5 MB.`,
    };
  }

  return { valid: true };
}

/**
 * ImageUploader: Accessible photo uploader supporting drag-and-drop, camera capture,
 * client-side reordering, and cover photo selection.
 */
export function ImageUploader({
  existingMedia = [],
  stagedFiles = [],
  onStagedFilesChange,
  images,
  onImagesChange,
  onDeleteExisting, // async (mediaId) => void
  onSetCoverExisting, // async (mediaId) => void
  onReorderExisting, // async (mediaId, newOrder) => void
  disabled = false,
  className = '',
}) {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const activeExistingMedia = images !== undefined ? images : existingMedia;
  const normalizedExisting = normalizeMediaList(activeExistingMedia);
  const totalCount = normalizedExisting.length + stagedFiles.length;

  const updateStagedFiles = (updater) => {
    if (onStagedFilesChange) {
      onStagedFilesChange(updater);
    } else if (onImagesChange) {
      onImagesChange(typeof updater === 'function' ? updater(stagedFiles) : updater);
    }
  };

  // Process incoming files from file picker or drag-and-drop
  const handleFiles = (filesList) => {
    setErrorMessage(null);
    const files = Array.from(filesList);
    if (files.length === 0) return;

    let currentCount = totalCount;
    const newStaged = [];
    const errors = [];

    for (const file of files) {
      const validation = validateImageFile(file, currentCount);
      if (!validation.valid) {
        errors.push(validation.error);
      } else {
        const previewUrl = URL.createObjectURL(file);
        newStaged.push({
          id: `staged-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          file,
          previewUrl,
          caption: '',
          isCover: totalCount === 0 && newStaged.length === 0,
        });
        currentCount++;
      }
    }

    if (errors.length > 0) {
      setErrorMessage(errors[0]);
    }

    if (newStaged.length > 0) {
      updateStagedFiles([...stagedFiles, ...newStaged]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (!disabled && e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // Reorder staged items
  const moveStaged = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= stagedFiles.length) return;
    const updated = [...stagedFiles];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    updateStagedFiles(updated);
  };

  // Set cover on staged item
  const setCoverStaged = (index) => {
    const updated = stagedFiles.map((item, idx) => ({
      ...item,
      isCover: idx === index,
    }));
    updateStagedFiles(updated);
  };

  // Remove staged item
  const removeStaged = (index) => {
    const item = stagedFiles[index];
    if (item?.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }
    const updated = stagedFiles.filter((_, idx) => idx !== index);
    // If we removed the cover, nominate the first remaining item
    if (item?.isCover && updated.length > 0 && normalizedExisting.length === 0) {
      updated[0].isCover = true;
    }
    updateStagedFiles(updated);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Upload Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-all',
          dragActive ? 'border-primary bg-primary/5' : 'border-border bg-sand/30 hover:bg-sand/60',
          disabled && 'opacity-60 cursor-not-allowed pointer-events-none'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = '';
          }}
          className="hidden"
          id="photo-file-input"
          disabled={disabled || totalCount >= MAX_MEDIA_COUNT}
        />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = '';
          }}
          className="hidden"
          id="photo-camera-input"
          disabled={disabled || totalCount >= MAX_MEDIA_COUNT}
        />

        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center text-primary shadow-warm-xs">
            <Upload className="w-6 h-6 stroke-[1.75]" />
          </div>

          <div className="space-y-1">
            <p className="font-serif text-base font-semibold text-ink">
              Drag and drop photos here, or browse
            </p>
            <p className="text-xs text-body">
              JPEG, PNG, or WebP up to 5 MB each. Up to {MAX_MEDIA_COUNT} photos total ({totalCount}/{MAX_MEDIA_COUNT} added).
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || totalCount >= MAX_MEDIA_COUNT}
              leftIcon={<Upload className="w-4 h-4" />}
              className="min-h-[44px]"
            >
              Browse Files
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => cameraInputRef.current?.click()}
              disabled={disabled || totalCount >= MAX_MEDIA_COUNT}
              leftIcon={<Camera className="w-4 h-4" />}
              className="min-h-[44px] sm:hidden"
            >
              Use Camera
            </Button>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Photos Thumbnail List (Uniform sizing, no mixed bento cells) */}
      {(normalizedExisting.length > 0 || stagedFiles.length > 0) && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between text-xs text-body px-1">
            <span className="font-medium text-ink">
              Selected Photos ({totalCount} of {MAX_MEDIA_COUNT})
            </span>
            <span>Cover photo appears first</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {/* Existing uploaded media */}
            {normalizedExisting.map((item, idx) => (
              <div
                key={item.id}
                className={cn(
                  'relative rounded-xl border overflow-hidden bg-card flex flex-col justify-between group',
                  item.isCover ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                )}
                style={{ aspectRatio: '4/3' }}
              >
                <img
                  src={item.url}
                  alt={item.caption || `Uploaded photo ${idx + 1}`}
                  className="w-full h-full object-cover"
                />

                {/* Cover badge */}
                {item.isCover && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-primary text-white text-2xs font-semibold uppercase tracking-wider">
                    Cover
                  </div>
                )}

                {/* Action buttons overlay */}
                <div className="absolute inset-0 bg-ink/60 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity p-2 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    {!item.isCover && onSetCoverExisting && (
                      <button
                        type="button"
                        onClick={() => onSetCoverExisting(item.id)}
                        className="px-2 py-1 rounded-md bg-card/90 hover:bg-card text-ink text-2xs font-semibold flex items-center gap-1 focus-ring"
                        aria-label="Set as cover image"
                      >
                        <Star className="w-3 h-3 text-amber fill-amber" />
                        <span>Cover</span>
                      </button>
                    )}
                    <span />
                    {onDeleteExisting && (
                      <button
                        type="button"
                        onClick={() => onDeleteExisting(item.id)}
                        className="p-1.5 rounded-md bg-danger text-white hover:bg-danger/90 focus-ring"
                        aria-label="Delete photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Reorder controls */}
                  {onReorderExisting && normalizedExisting.length > 1 && (
                    <div className="flex items-center justify-center gap-2">
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => onReorderExisting(item.id, idx - 1)}
                          className="p-1 rounded-md bg-card/90 text-ink hover:bg-card focus-ring"
                          aria-label="Move photo left"
                        >
                          <ArrowLeft className="w-3 h-3" />
                        </button>
                      )}
                      {idx < normalizedExisting.length - 1 && (
                        <button
                          type="button"
                          onClick={() => onReorderExisting(item.id, idx + 1)}
                          className="p-1 rounded-md bg-card/90 text-ink hover:bg-card focus-ring"
                          aria-label="Move photo right"
                        >
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Staged new media */}
            {stagedFiles.map((item, idx) => (
              <div
                key={item.id}
                className={cn(
                  'relative rounded-xl border overflow-hidden bg-card flex flex-col justify-between group',
                  item.isCover ? 'border-primary ring-2 ring-primary/20' : 'border-border'
                )}
                style={{ aspectRatio: '4/3' }}
              >
                <img
                  src={item.previewUrl}
                  alt={item.caption || `Staged photo ${idx + 1}`}
                  className="w-full h-full object-cover"
                />

                {/* Cover badge */}
                {item.isCover && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-primary text-white text-2xs font-semibold uppercase tracking-wider">
                    Cover
                  </div>
                )}

                {/* Overlay actions */}
                <div className="absolute inset-0 bg-ink/60 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity p-2 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    {!item.isCover && (
                      <button
                        type="button"
                        onClick={() => setCoverStaged(idx)}
                        className="px-2 py-1 rounded-md bg-card/90 hover:bg-card text-ink text-2xs font-semibold flex items-center gap-1 focus-ring"
                        aria-label="Set as cover image"
                      >
                        <Star className="w-3 h-3 text-amber fill-amber" />
                        <span>Cover</span>
                      </button>
                    )}
                    <span />
                    <button
                      type="button"
                      onClick={() => removeStaged(idx)}
                      className="p-1.5 rounded-md bg-danger text-white hover:bg-danger/90 focus-ring"
                      aria-label="Remove photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Reorder buttons */}
                  {stagedFiles.length > 1 && (
                    <div className="flex items-center justify-center gap-2">
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() => moveStaged(idx, -1)}
                          className="p-1 rounded-md bg-card/90 text-ink hover:bg-card focus-ring"
                          aria-label="Move left"
                        >
                          <ArrowLeft className="w-3 h-3" />
                        </button>
                      )}
                      {idx < stagedFiles.length - 1 && (
                        <button
                          type="button"
                          onClick={() => moveStaged(idx, 1)}
                          className="p-1 rounded-md bg-card/90 text-ink hover:bg-card focus-ring"
                          aria-label="Move right"
                        >
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
