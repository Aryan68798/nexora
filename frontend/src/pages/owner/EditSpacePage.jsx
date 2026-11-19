import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Layers,
  ArrowLeft,
  Camera,
  Save,
  Info,
} from 'lucide-react';
import { api } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { MoneyInput } from '../../components/owner/MoneyInput';
import { ImageUploader } from '../../components/owner/ImageUploader';
import { normalizeMediaList } from '../../lib/mediaUtils';
import { cn } from '../../lib/utils';

const SPACE_TYPES = [
  'ROOM',
  'OFFICE',
  'STUDIO',
  'SHOP',
  'CLASSROOM',
  'PARKING',
  'OTHER',
];

const editSpaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(150, 'Name cannot exceed 150 characters'),
  spaceType: z.enum(SPACE_TYPES),
  description: z.string().trim().max(2000).optional(),
  capacity: z.coerce
    .number()
    .int('Capacity must be a whole number')
    .min(1, 'Capacity must be at least 1 guest')
    .max(100000),
  priceAmount: z
    .string()
    .trim()
    .min(1, 'Price amount is required')
    .refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0 && /^\d+(\.\d{1,2})?$/.test(val);
    }, 'Price must be a valid amount with up to 2 decimal places'),
  priceUnit: z.enum(['HOUR', 'DAY']),
  rules: z.string().trim().max(1000).optional(),
  status: z.enum(['AVAILABLE', 'UNAVAILABLE', 'MAINTENANCE']),
});

export function EditSpacePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data: spaceData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['space', id],
    queryFn: () => api.get(`/api/spaces/${id}`),
    staleTime: 30 * 1000,
  });

  const space = spaceData?.data || spaceData;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(editSpaceSchema),
    defaultValues: {
      name: '',
      spaceType: 'ROOM',
      description: '',
      capacity: 1,
      priceAmount: '',
      priceUnit: 'HOUR',
      rules: '',
      status: 'AVAILABLE',
    },
  });

  useEffect(() => {
    if (space) {
      reset({
        name: space.name || '',
        spaceType: space.spaceType || 'ROOM',
        description: space.description || '',
        capacity: space.capacity || 1,
        priceAmount: String(space.priceAmount || ''),
        priceUnit: space.priceUnit || 'HOUR',
        rules: space.rules || '',
        status: space.status || 'AVAILABLE',
      });
    }
  }, [space, reset]);

  const updateMutation = useMutation({
    mutationFn: async (formData) => {
      const payload = {
        name: formData.name.trim(),
        spaceType: formData.spaceType,
        description: formData.description?.trim() || undefined,
        capacity: Number(formData.capacity),
        priceAmount: String(formData.priceAmount),
        priceUnit: formData.priceUnit,
        rules: formData.rules?.trim() || undefined,
        status: formData.status,
      };
      return api.patch(`/api/spaces/${id}`, payload);
    },
    onSuccess: () => {
      const propertyId = space?.property?.id || space?.propertyId;
      queryClient.invalidateQueries({ queryKey: ['space', id] });
      if (propertyId) {
        queryClient.invalidateQueries({ queryKey: ['ownerProperty', propertyId] });
      }
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
      toast.success('Space updated successfully');
      if (propertyId) {
        navigate(`/owner/properties/${propertyId}`);
      } else {
        navigate(-1);
      }
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to update space');
    },
  });

  // Media photo management for this space:
  const handleUploadPhoto = async (stagedItem) => {
    try {
      const formData = new FormData();
      formData.append('file', stagedItem.file);
      if (stagedItem.caption) formData.append('caption', stagedItem.caption);

      const res = await api.post(`/api/spaces/${id}/media`, formData);
      queryClient.invalidateQueries({ queryKey: ['space', id] });
      toast.success('Photo uploaded');
      return res?.data || res;
    } catch (err) {
      toast.error(err?.message || 'Failed to upload photo');
      throw err;
    }
  };

  const handleSetCoverPhoto = async (mediaId) => {
    try {
      await api.patch(`/api/space-media/${mediaId}`, { isCover: true });
      queryClient.invalidateQueries({ queryKey: ['space', id] });
      toast.success('Cover photo updated');
    } catch (err) {
      toast.error(err?.message || 'Failed to set cover photo');
    }
  };

  const handleDeletePhoto = async (mediaId) => {
    try {
      await api.delete(`/api/space-media/${mediaId}`);
      queryClient.invalidateQueries({ queryKey: ['space', id] });
      toast.success('Photo removed');
    } catch (err) {
      toast.error(err?.message || 'Failed to delete photo');
    }
  };

  const handleReorderPhoto = async (mediaId, newOrder) => {
    try {
      await api.patch(`/api/space-media/${mediaId}`, { sortOrder: newOrder });
      queryClient.invalidateQueries({ queryKey: ['space', id] });
      toast.success('Photo reordered');
    } catch (err) {
      toast.error(err?.message || 'Failed to reorder photo');
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <div className="h-8 w-48 bg-sand rounded skeleton-shimmer" />
        <div className="h-64 rounded-2xl bg-sand skeleton-shimmer" />
      </div>
    );
  }

  if (isError || !space) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-danger font-semibold">{error?.message || 'Space not found'}</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </div>
    );
  }

  const normalizedMedia = normalizeMediaList(space.media || []);
  const propertyId = space?.property?.id || space?.propertyId;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => (propertyId ? navigate(`/owner/properties/${propertyId}`) : navigate(-1))}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          className="min-h-[44px]"
        >
          Back
        </Button>
        <h1 className="font-editorial text-2xl sm:text-3xl font-light text-ink tracking-tight">
          Edit Space
        </h1>
      </div>

      <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="space-y-6">
        {/* Space Information */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-xs space-y-4">
          <h2 className="font-serif text-lg font-semibold text-ink flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <span>Space Information</span>
          </h2>

          <div className="space-y-1.5">
            <label htmlFor="edit-space-name" className="block text-xs font-semibold uppercase tracking-wider text-ink">
              Space Name <span className="text-danger">*</span>
            </label>
            <input
              id="edit-space-name"
              type="text"
              {...register('name')}
              className={cn(
                'w-full px-4 py-2.5 rounded-xl border bg-sand/30 text-ink text-sm font-medium focus-ring min-h-[44px]',
                errors.name ? 'border-danger' : 'border-border focus:border-primary'
              )}
            />
            {errors.name && <p className="text-xs text-danger font-medium">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="edit-space-type" className="block text-xs font-semibold uppercase tracking-wider text-ink">
                Space Type <span className="text-danger">*</span>
              </label>
              <select
                id="edit-space-type"
                {...register('spaceType')}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-sand/30 text-ink text-sm font-medium focus-ring min-h-[44px] cursor-pointer"
              >
                {SPACE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="edit-capacity" className="block text-xs font-semibold uppercase tracking-wider text-ink">
                Guest Capacity <span className="text-danger">*</span>
              </label>
              <input
                id="edit-capacity"
                type="number"
                min="1"
                max="100000"
                {...register('capacity')}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-sand/30 text-ink text-sm font-medium focus-ring min-h-[44px]"
              />
              {errors.capacity && <p className="text-xs text-danger font-medium">{errors.capacity.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-space-desc" className="block text-xs font-semibold uppercase tracking-wider text-ink">
              Description
            </label>
            <textarea
              id="edit-space-desc"
              rows={3}
              {...register('description')}
              className="w-full px-4 py-3 rounded-xl border border-border bg-sand/30 text-ink text-sm font-medium focus-ring focus:border-primary"
            />
          </div>
        </div>

        {/* Pricing Card */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-xs space-y-4">
          <h2 className="font-serif text-lg font-semibold text-ink">Pricing</h2>

          {/* Pricing Note */}
          <div className="p-3.5 rounded-xl bg-sand/60 border border-border flex items-start gap-2.5 text-xs text-body leading-relaxed">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <span>
              Changing price applies to new bookings. Existing bookings and active reservations keep their booked price.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="edit-price" className="block text-xs font-semibold uppercase tracking-wider text-ink">
                Base Price <span className="text-danger">*</span>
              </label>
              <Controller
                name="priceAmount"
                control={control}
                render={({ field }) => (
                  <MoneyInput
                    id="edit-price"
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={Boolean(errors.priceAmount)}
                  />
                )}
              />
              {errors.priceAmount && <p className="text-xs text-danger font-medium">{errors.priceAmount.message}</p>}
            </div>

            <div className="space-y-1.5">
              <span className="block text-xs font-semibold uppercase tracking-wider text-ink">
                Billing Period <span className="text-danger">*</span>
              </span>
              <Controller
                name="priceUnit"
                control={control}
                render={({ field }) => (
                  <div className="grid grid-cols-2 p-1 bg-sand/50 rounded-xl border border-border min-h-[44px]">
                    <button
                      type="button"
                      onClick={() => field.onChange('HOUR')}
                      className={cn(
                        'py-1.5 rounded-lg text-xs font-semibold transition-all focus-ring',
                        field.value === 'HOUR' ? 'bg-card text-ink shadow-warm-xs' : 'text-body hover:text-ink'
                      )}
                    >
                      Per Hour
                    </button>
                    <button
                      type="button"
                      onClick={() => field.onChange('DAY')}
                      className={cn(
                        'py-1.5 rounded-lg text-xs font-semibold transition-all focus-ring',
                        field.value === 'DAY' ? 'bg-card text-ink shadow-warm-xs' : 'text-body hover:text-ink'
                      )}
                    >
                      Per Day
                    </button>
                  </div>
                )}
              />
            </div>
          </div>
        </div>

        {/* Rules & Status Card */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-xs space-y-4">
          <h2 className="font-serif text-lg font-semibold text-ink">Rules & Status</h2>

          <div className="space-y-1.5">
            <label htmlFor="edit-rules" className="block text-xs font-semibold uppercase tracking-wider text-ink">
              House Rules
            </label>
            <textarea
              id="edit-rules"
              rows={2}
              {...register('rules')}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-sand/30 text-ink text-sm font-medium focus-ring focus:border-primary"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-space-status" className="block text-xs font-semibold uppercase tracking-wider text-ink">
              Current Status
            </label>
            <select
              id="edit-space-status"
              {...register('status')}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-sand/30 text-ink text-sm font-medium focus-ring min-h-[44px] cursor-pointer"
            >
              <option value="AVAILABLE">AVAILABLE</option>
              <option value="UNAVAILABLE">UNAVAILABLE</option>
              <option value="MAINTENANCE">MAINTENANCE</option>
            </select>
          </div>
        </div>

        {/* Photos Card */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-xs space-y-4">
          <h2 className="font-serif text-lg font-semibold text-ink flex items-center gap-2">
            <Camera className="w-5 h-5 text-primary" />
            <span>Space Photos ({normalizedMedia.length} of 10)</span>
          </h2>

          <ImageUploader
            existingMedia={normalizedMedia}
            onUploadFile={handleUploadPhoto}
            onSetCoverExisting={handleSetCoverPhoto}
            onDeleteExisting={handleDeletePhoto}
            onReorderExisting={handleReorderPhoto}
            onStagedFilesChange={(newFiles) => {
              if (newFiles.length > 0) {
                const latest = newFiles[newFiles.length - 1];
                handleUploadPhoto(latest);
              }
            }}
          />
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => (propertyId ? navigate(`/owner/properties/${propertyId}`) : navigate(-1))}
            className="min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={updateMutation.isPending}
            disabled={!isDirty || updateMutation.isPending}
            leftIcon={<Save className="w-4 h-4" />}
            className="min-h-[44px]"
          >
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
