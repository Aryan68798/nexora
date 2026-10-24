import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import {
  Layers,
  ArrowLeft,
  Camera,
  Plus,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { api, ApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { MoneyInput } from '../../components/owner/MoneyInput';
import { ImageUploader } from '../../components/owner/ImageUploader';
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

const spaceFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(150, 'Name cannot exceed 150 characters'),
  spaceType: z.enum(SPACE_TYPES, {
    errorMap: () => ({ message: 'Please select a valid space type' }),
  }),
  description: z.string().trim().max(2000).optional(),
  capacity: z.coerce
    .number({ invalid_type_error: 'Capacity is required and must be a number' })
    .int('Capacity must be a whole number')
    .min(1, 'Capacity must be at least 1 guest')
    .max(100000, 'Capacity cannot exceed 100,000'),
  priceAmount: z
    .string()
    .trim()
    .min(1, 'Price amount is required')
    .refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0 && /^\d+(\.\d{1,2})?$/.test(val);
    }, 'Price must be a valid positive amount with up to 2 decimal places'),
  priceUnit: z.enum(['HOUR', 'DAY']),
  rules: z.string().trim().max(1000).optional(),
  status: z.enum(['AVAILABLE', 'UNAVAILABLE', 'MAINTENANCE']).default('AVAILABLE'),
});

export function AddSpacePage() {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [stagedPhotos, setStagedPhotos] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [createdSpaceId, setCreatedSpaceId] = useState(null);
  const [serverError, setServerError] = useState(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(spaceFormSchema),
    defaultValues: {
      name: '',
      spaceType: 'ROOM',
      description: '',
      capacity: '',
      priceAmount: '',
      priceUnit: 'HOUR',
      rules: '',
      status: 'AVAILABLE',
    },
    mode: 'onTouched',
  });

  const onSubmit = async (data) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setServerError(null);

    const payload = {
      name: data.name.trim(),
      spaceType: data.spaceType,
      description: data.description?.trim() || undefined,
      capacity: Number(data.capacity),
      priceAmount: String(data.priceAmount),
      priceUnit: data.priceUnit,
      rules: data.rules?.trim() || undefined,
      status: data.status,
    };

    let newSpaceId = null;

    try {
      const res = await api.post(`/api/properties/${propertyId}/spaces`, payload);
      const space = res?.data || res;
      newSpaceId = space.id;
      setCreatedSpaceId(newSpaceId);
      queryClient.invalidateQueries({ queryKey: ['ownerProperty', propertyId] });
      queryClient.invalidateQueries({ queryKey: ['spaces'] });
    } catch (err) {
      setIsSubmitting(false);
      const msg = err instanceof ApiError ? err.message : 'Failed to create space. Please verify details.';
      setServerError(msg);
      toast.error(msg);
      return;
    }

    // Upload staged photos if added
    if (stagedPhotos.length > 0 && newSpaceId) {
      setUploadStatus({ current: 0, total: stagedPhotos.length });
      for (let i = 0; i < stagedPhotos.length; i++) {
        const item = stagedPhotos[i];
        setUploadStatus((prev) => ({ ...prev, current: i + 1 }));
        try {
          const formData = new FormData();
          formData.append('file', item.file);
          if (item.caption) formData.append('caption', item.caption);

          const uploadRes = await api.post(`/api/spaces/${newSpaceId}/media`, formData);
          const uploaded = uploadRes?.data || uploadRes;
          if (item.isCover && i > 0 && uploaded?.id) {
            await api.patch(`/api/space-media/${uploaded.id}`, { isCover: true });
          }
        } catch {
          // Continue with next photo
        }
      }
    }

    setIsSubmitting(false);
    toast.success('Space added successfully');
  };

  const handleAddAnother = () => {
    reset({
      name: '',
      spaceType: 'ROOM',
      description: '',
      capacity: '',
      priceAmount: '',
      priceUnit: 'HOUR',
      rules: '',
      status: 'AVAILABLE',
    });
    setStagedPhotos([]);
    setCreatedSpaceId(null);
    setUploadStatus(null);
  };

  const handleFinish = () => {
    navigate(`/owner/properties/${propertyId}`);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/owner/properties/${propertyId}`)}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          className="min-h-[44px]"
        >
          Back to Property
        </Button>
        <div>
          <h1 className="font-editorial text-2xl sm:text-3xl font-light text-ink tracking-tight">
            Add a Rentable Space
          </h1>
          <p className="text-body text-xs mt-0.5">
            Define pricing, guest capacity, rules, and photos for this space.
          </p>
        </div>
      </div>

      {/* Success Dialog when space is saved */}
      {createdSpaceId ? (
        <div className="bg-card rounded-2xl border border-border p-8 shadow-warm-xs text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-success/10 border border-success/30 flex items-center justify-center mx-auto text-success">
            <CheckCircle2 className="w-7 h-7 stroke-[1.75]" />
          </div>
          <div className="space-y-1">
            <h2 className="font-serif text-2xl font-bold text-ink">Space Added Successfully</h2>
            <p className="text-body text-sm max-w-md mx-auto">
              Your new space is now registered. Would you like to add another space to this property or view the property details?
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              variant="outline"
              onClick={handleAddAnother}
              leftIcon={<Plus className="w-4 h-4" />}
              className="w-full sm:w-auto min-h-[44px]"
            >
              Add Another Space
            </Button>
            <Button
              variant="primary"
              onClick={handleFinish}
              className="w-full sm:w-auto min-h-[44px]"
            >
              Finish & View Property
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Server Error */}
          {serverError && (
            <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm font-medium flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          {/* Section 1: Space Basics */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-xs space-y-4">
            <h2 className="font-serif text-xl font-semibold text-ink flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              <span>Space Information</span>
            </h2>

            {/* Name */}
            <div className="space-y-1.5">
              <label htmlFor="space-name" className="block text-xs font-semibold uppercase tracking-wider text-ink">
                Space Name <span className="text-danger">*</span>
              </label>
              <input
                id="space-name"
                type="text"
                {...register('name')}
                placeholder="e.g. Garden Courtyard Studio"
                className={cn(
                  'w-full px-4 py-2.5 rounded-xl border bg-sand/30 text-ink text-sm font-medium focus-ring min-h-[44px]',
                  errors.name ? 'border-danger' : 'border-border focus:border-primary'
                )}
              />
              {errors.name && <p className="text-xs text-danger font-medium">{errors.name.message}</p>}
            </div>

            {/* Type & Capacity */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="space-type" className="block text-xs font-semibold uppercase tracking-wider text-ink">
                  Space Type <span className="text-danger">*</span>
                </label>
                <select
                  id="space-type"
                  {...register('spaceType')}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-sand/30 text-ink text-sm font-medium focus-ring min-h-[44px] cursor-pointer"
                >
                  {SPACE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                {errors.spaceType && <p className="text-xs text-danger font-medium">{errors.spaceType.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="space-capacity" className="block text-xs font-semibold uppercase tracking-wider text-ink">
                  Guest Capacity <span className="text-danger">*</span>
                </label>
                <input
                  id="space-capacity"
                  type="number"
                  min="1"
                  max="100000"
                  {...register('capacity')}
                  placeholder="e.g. 12"
                  className={cn(
                    'w-full px-4 py-2.5 rounded-xl border bg-sand/30 text-ink text-sm font-medium focus-ring min-h-[44px]',
                    errors.capacity ? 'border-danger' : 'border-border focus:border-primary'
                  )}
                />
                {errors.capacity && <p className="text-xs text-danger font-medium">{errors.capacity.message}</p>}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label htmlFor="space-desc" className="block text-xs font-semibold uppercase tracking-wider text-ink">
                Description
              </label>
              <textarea
                id="space-desc"
                rows={3}
                {...register('description')}
                placeholder="Mention seating setup, natural lighting, audio-visual equipment, and ideal use cases..."
                className="w-full px-4 py-3 rounded-xl border border-border bg-sand/30 text-ink text-sm font-medium focus-ring focus:border-primary"
              />
              {errors.description && <p className="text-xs text-danger font-medium">{errors.description.message}</p>}
            </div>
          </div>

          {/* Section 2: Pricing */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-xs space-y-4">
            <h2 className="font-serif text-xl font-semibold text-ink">Pricing & Rates</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Money Input */}
              <div className="space-y-1.5">
                <label htmlFor="space-price" className="block text-xs font-semibold uppercase tracking-wider text-ink">
                  Base Price <span className="text-danger">*</span>
                </label>
                <Controller
                  name="priceAmount"
                  control={control}
                  render={({ field }) => (
                    <MoneyInput
                      id="space-price"
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      placeholder="1500.00"
                      error={Boolean(errors.priceAmount)}
                    />
                  )}
                />
                {errors.priceAmount && <p className="text-xs text-danger font-medium">{errors.priceAmount.message}</p>}
              </div>

              {/* Price Unit Segmented Control */}
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

          {/* Section 3: Rules & Status */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-xs space-y-4">
            <h2 className="font-serif text-xl font-semibold text-ink">Rules & Status</h2>

            <div className="space-y-1.5">
              <label htmlFor="space-rules" className="block text-xs font-semibold uppercase tracking-wider text-ink">
                House Rules & Access Instructions
              </label>
              <textarea
                id="space-rules"
                rows={2}
                {...register('rules')}
                placeholder="e.g. Quiet hours after 9 PM, no smoking, shoes off at the entrance..."
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-sand/30 text-ink text-sm font-medium focus-ring focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="space-status" className="block text-xs font-semibold uppercase tracking-wider text-ink">
                Initial Status
              </label>
              <select
                id="space-status"
                {...register('status')}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-sand/30 text-ink text-sm font-medium focus-ring min-h-[44px] cursor-pointer"
              >
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="UNAVAILABLE">UNAVAILABLE</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
              </select>
            </div>
          </div>

          {/* Section 4: Photos */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-xs space-y-4">
            <h2 className="font-serif text-xl font-semibold text-ink flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              <span>Space Photos</span>
            </h2>
            <p className="text-body text-xs">
              Upload up to 10 photos showcasing interior angles, natural lighting, and work surfaces.
            </p>

            <ImageUploader
              stagedFiles={stagedPhotos}
              onStagedFilesChange={setStagedPhotos}
            />

            {/* Upload progress during submit */}
            {uploadStatus && (
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-2 text-primary text-xs font-semibold">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Uploading photos ({uploadStatus.current} of {uploadStatus.total})...</span>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate(`/owner/properties/${propertyId}`)}
              disabled={isSubmitting}
              className="min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              disabled={isSubmitting}
              className="min-h-[44px]"
            >
              Save Space
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
