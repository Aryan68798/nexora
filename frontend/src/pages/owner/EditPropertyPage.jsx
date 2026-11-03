import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  MapPin,
  ArrowLeft,
  ChevronDown,
  Save,
} from 'lucide-react';
import { api } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import { cn } from '../../lib/utils';

const PROPERTY_TYPES = [
  'APARTMENT',
  'HOUSE',
  'VILLA',
  'COMMERCIAL',
  'OFFICE_BUILDING',
  'HOSTEL',
  'WAREHOUSE',
  'OTHER',
];

const editPropertySchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(150, 'Title cannot exceed 150 characters'),
  propertyType: z.enum(PROPERTY_TYPES),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE']),
  addressLine1: z
    .string()
    .trim()
    .min(3, 'Address line 1 must be at least 3 characters')
    .max(200),
  addressLine2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  postalCode: z.string().trim().min(4).max(10),
  country: z.string().trim().default('India'),
});

export function EditPropertyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data: propertyData,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['ownerProperty', id],
    queryFn: () => api.get(`/api/properties/${id}`),
  });

  const property = propertyData?.data || propertyData;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(editPropertySchema),
    defaultValues: {
      title: '',
      propertyType: 'COMMERCIAL',
      description: '',
      status: 'ACTIVE',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India',
    },
  });

  useEffect(() => {
    if (property) {
      reset({
        title: property.title || '',
        propertyType: property.propertyType || 'COMMERCIAL',
        description: property.description || '',
        status: property.status || 'ACTIVE',
        addressLine1: property.addressLine1 || '',
        addressLine2: property.addressLine2 || '',
        city: property.city || '',
        state: property.state || '',
        postalCode: property.postalCode || '',
        country: property.country || 'India',
      });
    }
  }, [property, reset]);

  const updateMutation = useMutation({
    mutationFn: async (formData) => {
      const payload = {
        title: formData.title.trim(),
        propertyType: formData.propertyType,
        description: formData.description?.trim() || undefined,
        status: formData.status,
        addressLine1: formData.addressLine1.trim(),
        addressLine2: formData.addressLine2?.trim() || undefined,
        city: formData.city.trim(),
        state: formData.state.trim(),
        postalCode: formData.postalCode.trim(),
        country: formData.country?.trim() || 'India',
      };
      return api.patch(`/api/properties/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ownerProperty', id] });
      queryClient.invalidateQueries({ queryKey: ['ownerProperties'] });
      toast.success('Property updated successfully');
      navigate(`/owner/properties/${id}`);
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to update property');
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <div className="h-8 w-48 bg-sand rounded skeleton-shimmer" />
        <div className="h-64 rounded-2xl bg-sand skeleton-shimmer" />
      </div>
    );
  }

  if (isError || !property) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-danger font-semibold">{error?.message || 'Property not found'}</p>
        <Button variant="outline" onClick={() => navigate('/owner/properties')}>
          Back to Properties
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/owner/properties/${id}`)}
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          className="min-h-[44px]"
        >
          Back
        </Button>
        <h1 className="font-editorial text-2xl sm:text-3xl font-light text-ink tracking-tight">
          Edit Property
        </h1>
      </div>

      <form onSubmit={handleSubmit((data) => updateMutation.mutate(data))} className="space-y-6">
        {/* Basic Details Card */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-xs space-y-4">
          <h2 className="font-serif text-lg font-semibold text-ink flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <span>General Information</span>
          </h2>

          <div className="space-y-1.5">
            <label htmlFor="edit-title" className="block text-xs font-semibold uppercase tracking-wider text-ink">
              Title <span className="text-danger">*</span>
            </label>
            <input
              id="edit-title"
              type="text"
              {...register('title')}
              className={cn(
                'w-full px-4 py-2.5 rounded-xl border bg-sand/30 text-ink text-sm font-medium focus-ring min-h-[44px]',
                errors.title ? 'border-danger' : 'border-border focus:border-primary'
              )}
            />
            {errors.title && <p className="text-xs text-danger">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="edit-type" className="block text-xs font-semibold uppercase tracking-wider text-ink">
                Category <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <select
                  id="edit-type"
                  {...register('propertyType')}
                  className="w-full appearance-none px-4 py-2.5 pr-8 rounded-xl border border-border bg-sand/30 text-ink text-sm font-medium focus-ring min-h-[44px] cursor-pointer"
                >
                  {PROPERTY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-body absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="edit-status" className="block text-xs font-semibold uppercase tracking-wider text-ink">
                Status <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <select
                  id="edit-status"
                  {...register('status')}
                  className="w-full appearance-none px-4 py-2.5 pr-8 rounded-xl border border-border bg-sand/30 text-ink text-sm font-medium focus-ring min-h-[44px] cursor-pointer"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="UNDER_MAINTENANCE">UNDER MAINTENANCE</option>
                </select>
                <ChevronDown className="w-4 h-4 text-body absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-desc" className="block text-xs font-semibold uppercase tracking-wider text-ink">
              Description
            </label>
            <textarea
              id="edit-desc"
              rows={4}
              {...register('description')}
              className="w-full px-4 py-3 rounded-xl border border-border bg-sand/30 text-ink text-sm font-medium focus-ring focus:border-primary"
            />
            {errors.description && <p className="text-xs text-danger">{errors.description.message}</p>}
          </div>
        </div>

        {/* Address Card */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-xs space-y-4">
          <h2 className="font-serif text-lg font-semibold text-ink flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            <span>Address</span>
          </h2>

          <div className="space-y-1.5">
            <label htmlFor="edit-addr1" className="block text-xs font-semibold uppercase tracking-wider text-ink">
              Address Line 1 <span className="text-danger">*</span>
            </label>
            <input
              id="edit-addr1"
              type="text"
              {...register('addressLine1')}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-sand/30 text-ink text-sm font-medium focus-ring min-h-[44px]"
            />
            {errors.addressLine1 && <p className="text-xs text-danger">{errors.addressLine1.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="edit-addr2" className="block text-xs font-semibold uppercase tracking-wider text-ink">
              Address Line 2
            </label>
            <input
              id="edit-addr2"
              type="text"
              {...register('addressLine2')}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-sand/30 text-ink text-sm font-medium focus-ring min-h-[44px]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="edit-city" className="block text-xs font-semibold uppercase tracking-wider text-ink">
                City <span className="text-danger">*</span>
              </label>
              <input
                id="edit-city"
                type="text"
                {...register('city')}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-sand/30 text-ink text-sm font-medium focus-ring min-h-[44px]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="edit-state" className="block text-xs font-semibold uppercase tracking-wider text-ink">
                State <span className="text-danger">*</span>
              </label>
              <input
                id="edit-state"
                type="text"
                {...register('state')}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-sand/30 text-ink text-sm font-medium focus-ring min-h-[44px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="edit-postal" className="block text-xs font-semibold uppercase tracking-wider text-ink">
                Postal Code <span className="text-danger">*</span>
              </label>
              <input
                id="edit-postal"
                type="text"
                {...register('postalCode')}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-sand/30 text-ink text-sm font-medium focus-ring min-h-[44px]"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="edit-country" className="block text-xs font-semibold uppercase tracking-wider text-ink">
                Country
              </label>
              <input
                id="edit-country"
                type="text"
                {...register('country')}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-sand/30 text-ink text-sm font-medium focus-ring min-h-[44px]"
              />
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(`/owner/properties/${id}`)}
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
