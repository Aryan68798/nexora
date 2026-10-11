import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Building2,
  MapPin,
  Camera,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { api, ApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Stepper } from '../../components/ui/Stepper';
import { useToast } from '../../components/ui/Toast';
import { ImageUploader } from '../../components/owner/ImageUploader';
import { cn } from '../../lib/utils';

const DRAFT_STORAGE_KEY = 'nexora:property_draft';

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

// Step 1: Basics schema
const basicsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(150, 'Title cannot exceed 150 characters'),
  propertyType: z.enum(PROPERTY_TYPES, {
    errorMap: () => ({ message: 'Please select a valid property type' }),
  }),
  description: z.string().trim().max(2000, 'Description cannot exceed 2000 characters').optional(),
});

// Step 2: Location schema
const locationSchema = z.object({
  addressLine1: z
    .string()
    .trim()
    .min(3, 'Address line 1 must be at least 3 characters')
    .max(200, 'Address line 1 cannot exceed 200 characters'),
  addressLine2: z.string().trim().max(200).optional(),
  city: z
    .string()
    .trim()
    .min(2, 'City must be at least 2 characters')
    .max(100, 'City cannot exceed 100 characters'),
  state: z
    .string()
    .trim()
    .min(2, 'State must be at least 2 characters')
    .max(100, 'State cannot exceed 100 characters'),
  postalCode: z
    .string()
    .trim()
    .min(4, 'Postal code must be at least 4 characters')
    .max(10, 'Postal code cannot exceed 10 characters'),
  country: z.string().trim().default('India'),
  latitude: z.coerce.number().min(-90).max(90).optional().or(z.literal('')),
  longitude: z.coerce.number().min(-180).max(180).optional().or(z.literal('')),
});

const fullPropertySchema = basicsSchema.and(locationSchema);

export function ListPropertyPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [showCoordinates, setShowCoordinates] = useState(false);
  const [stagedPhotos, setStagedPhotos] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null); // { current, total, failed: [] }
  const [serverError, setServerError] = useState(null);

  // Restore draft from sessionStorage if available
  const getInitialValues = () => {
    try {
      const saved = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Ignore storage parse errors
    }
    return {
      title: '',
      propertyType: 'COMMERCIAL',
      description: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India',
      latitude: '',
      longitude: '',
    };
  };

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(fullPropertySchema),
    defaultValues: getInitialValues(),
    mode: 'onTouched',
  });

  const formValues = watch();

  // Save form progress to sessionStorage on changes
  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formValues));
    } catch {
      // Ignore storage quota errors
    }
  }, [formValues]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      stagedPhotos.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, [stagedPhotos]);

  const stepsList = [
    { title: 'Basics', description: 'Name and type' },
    { title: 'Location', description: 'Address and city' },
    { title: 'Photos', description: 'Upload images' },
    { title: 'Review', description: 'Verify and create' },
  ];

  // Navigate forward through steps with per-step validation
  const handleNext = async () => {
    setServerError(null);
    if (currentStep === 1) {
      const isValid = await trigger(['title', 'propertyType', 'description']);
      if (isValid) setCurrentStep(2);
    } else if (currentStep === 2) {
      const isValid = await trigger([
        'addressLine1',
        'addressLine2',
        'city',
        'state',
        'postalCode',
        'country',
        'latitude',
        'longitude',
      ]);
      if (isValid) setCurrentStep(3);
    } else if (currentStep === 3) {
      setCurrentStep(4);
    }
  };

  const handleBack = () => {
    setServerError(null);
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  // Submit flow: Create property first, then upload photos sequentially
  const onSubmit = async (data) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setServerError(null);

    const propertyPayload = {
      title: data.title.trim(),
      propertyType: data.propertyType,
      description: data.description?.trim() || undefined,
      addressLine1: data.addressLine1.trim(),
      addressLine2: data.addressLine2?.trim() || undefined,
      city: data.city.trim(),
      state: data.state.trim(),
      postalCode: data.postalCode.trim(),
      country: data.country?.trim() || 'India',
      latitude: data.latitude !== '' && data.latitude != null ? Number(data.latitude) : undefined,
      longitude: data.longitude !== '' && data.longitude != null ? Number(data.longitude) : undefined,
    };

    let createdPropertyId = null;

    try {
      // Step 1: Create Property
      const res = await api.post('/api/properties', propertyPayload);
      const property = res?.data || res;
      createdPropertyId = property.id;

      // Clear draft on creation
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (err) {
      setIsSubmitting(false);
      const msg = err instanceof ApiError ? err.message : 'Failed to create property. Please verify your details.';
      setServerError(msg);
      toast.error(msg);
      return;
    }

    // Step 2: Upload staged photos sequentially if any were added
    if (stagedPhotos.length > 0 && createdPropertyId) {
      setUploadStatus({ current: 0, total: stagedPhotos.length, failed: [] });
      const failedUploads = [];

      for (let i = 0; i < stagedPhotos.length; i++) {
        const item = stagedPhotos[i];
        setUploadStatus((prev) => ({ ...prev, current: i + 1 }));

        try {
          const formData = new FormData();
          formData.append('file', item.file);
          if (item.caption) {
            formData.append('caption', item.caption);
          }

          const uploadRes = await api.post(`/api/properties/${createdPropertyId}/media`, formData);
          const uploadedItem = uploadRes?.data || uploadRes;

          // If this was chosen as cover and wasn't the first item, mark cover
          if (item.isCover && i > 0 && uploadedItem?.id) {
            await api.patch(`/api/property-media/${uploadedItem.id}`, { isCover: true });
          }
        } catch {
          failedUploads.push(item.file.name);
        }
      }

      if (failedUploads.length > 0) {
        toast.warning(
          `Property created. ${stagedPhotos.length - failedUploads.length} photos uploaded, but ${failedUploads.length} failed. You can re-upload them on the property page.`
        );
      } else {
        toast.success('Property created successfully with all photos');
      }
    } else {
      toast.success('Property created successfully');
    }

    setIsSubmitting(false);
    navigate(`/owner/properties/${createdPropertyId}`, {
      state: { promptAddSpace: true },
    });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Title */}
      <div>
        <h1 className="font-editorial text-3xl sm:text-4xl font-light text-ink tracking-tight">
          List a New Property
        </h1>
        <p className="text-body text-sm mt-1">
          Complete the steps below to register your building, haveli, office, or studio complex.
        </p>
      </div>

      {/* Stepper Header */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-warm-xs">
        <Stepper
          steps={stepsList}
          currentStep={currentStep}
          onStepClick={(step) => {
            if (step < currentStep) setCurrentStep(step);
          }}
        />
      </div>

      {/* Server Error Alert */}
      {serverError && (
        <div className="p-4 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm font-medium flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      {/* Main Step Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* ── STEP 1: BASICS ── */}
        {currentStep === 1 && (
          <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-xs space-y-5">
            <h2 className="font-serif text-xl font-semibold text-ink flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              <span>Basic Information</span>
            </h2>

            {/* Title */}
            <div className="space-y-1.5">
              <label htmlFor="property-title" className="block text-xs font-semibold uppercase tracking-wider text-ink">
                Property Title <span className="text-danger">*</span>
              </label>
              <input
                id="property-title"
                type="text"
                {...register('title')}
                placeholder="e.g. Horizon Innovation Center"
                className={cn(
                  'w-full px-4 py-2.5 rounded-xl border bg-sand/30 text-ink text-sm font-medium focus-ring min-h-[44px]',
                  errors.title ? 'border-danger' : 'border-border focus:border-primary'
                )}
              />
              {errors.title && (
                <p className="text-xs text-danger font-medium">{errors.title.message}</p>
              )}
            </div>

            {/* Property Type */}
            <div className="space-y-1.5">
              <label htmlFor="property-type" className="block text-xs font-semibold uppercase tracking-wider text-ink">
                Property Category <span className="text-danger">*</span>
              </label>
              <div className="relative">
                <select
                  id="property-type"
                  {...register('propertyType')}
                  className={cn(
                    'w-full appearance-none px-4 py-2.5 pr-10 rounded-xl border bg-sand/30 text-ink text-sm font-medium focus-ring min-h-[44px] cursor-pointer',
                    errors.propertyType ? 'border-danger' : 'border-border focus:border-primary'
                  )}
                >
                  {PROPERTY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-body absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              {errors.propertyType && (
                <p className="text-xs text-danger font-medium">{errors.propertyType.message}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label htmlFor="property-desc" className="block text-xs font-semibold uppercase tracking-wider text-ink">
                  Description
                </label>
                <span className="text-2xs text-body tabular-nums">
                  {(watch('description') || '').length}/2000
                </span>
              </div>
              <textarea
                id="property-desc"
                rows={4}
                {...register('description')}
                placeholder="Describe your building, access points, common facilities, and neighborhood amenities..."
                className="w-full px-4 py-3 rounded-xl border border-border bg-sand/30 text-ink text-sm font-medium focus-ring focus:border-primary"
              />
              {errors.description && (
                <p className="text-xs text-danger font-medium">{errors.description.message}</p>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 2: LOCATION ── */}
        {currentStep === 2 && (
          <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-xs space-y-5">
            <h2 className="font-serif text-xl font-semibold text-ink flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              <span>Location Details</span>
            </h2>

            {/* Address Line 1 */}
            <div className="space-y-1.5">
              <label htmlFor="address-1" className="block text-xs font-semibold uppercase tracking-wider text-ink">
                Street Address <span className="text-danger">*</span>
              </label>
              <input
                id="address-1"
                type="text"
                {...register('addressLine1')}
                placeholder="e.g. 80 Feet Road, 4th Block"
                className={cn(
                  'w-full px-4 py-2.5 rounded-xl border bg-sand/30 text-ink text-sm font-medium focus-ring min-h-[44px]',
                  errors.addressLine1 ? 'border-danger' : 'border-border focus:border-primary'
                )}
              />
              {errors.addressLine1 && (
                <p className="text-xs text-danger font-medium">{errors.addressLine1.message}</p>
              )}
            </div>

            {/* Address Line 2 */}
            <div className="space-y-1.5">
              <label htmlFor="address-2" className="block text-xs font-semibold uppercase tracking-wider text-ink">
                Suite / Wing / Landmark (Optional)
              </label>
              <input
                id="address-2"
                type="text"
                {...register('addressLine2')}
                placeholder="e.g. Near Sony World Junction, Wing B"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-sand/30 text-ink text-sm font-medium focus-ring focus:border-primary min-h-[44px]"
              />
            </div>

            {/* City & State Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="city" className="block text-xs font-semibold uppercase tracking-wider text-ink">
                  City <span className="text-danger">*</span>
                </label>
                <input
                  id="city"
                  type="text"
                  {...register('city')}
                  placeholder="e.g. Bengaluru"
                  className={cn(
                    'w-full px-4 py-2.5 rounded-xl border bg-sand/30 text-ink text-sm font-medium focus-ring min-h-[44px]',
                    errors.city ? 'border-danger' : 'border-border focus:border-primary'
                  )}
                />
                {errors.city && (
                  <p className="text-xs text-danger font-medium">{errors.city.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="state" className="block text-xs font-semibold uppercase tracking-wider text-ink">
                  State <span className="text-danger">*</span>
                </label>
                <input
                  id="state"
                  type="text"
                  {...register('state')}
                  placeholder="e.g. Karnataka"
                  className={cn(
                    'w-full px-4 py-2.5 rounded-xl border bg-sand/30 text-ink text-sm font-medium focus-ring min-h-[44px]',
                    errors.state ? 'border-danger' : 'border-border focus:border-primary'
                  )}
                />
                {errors.state && (
                  <p className="text-xs text-danger font-medium">{errors.state.message}</p>
                )}
              </div>
            </div>

            {/* Postal Code & Country */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="postal-code" className="block text-xs font-semibold uppercase tracking-wider text-ink">
                  Postal Code (PIN) <span className="text-danger">*</span>
                </label>
                <input
                  id="postal-code"
                  type="text"
                  {...register('postalCode')}
                  placeholder="e.g. 560034"
                  className={cn(
                    'w-full px-4 py-2.5 rounded-xl border bg-sand/30 text-ink text-sm font-medium focus-ring min-h-[44px]',
                    errors.postalCode ? 'border-danger' : 'border-border focus:border-primary'
                  )}
                />
                {errors.postalCode && (
                  <p className="text-xs text-danger font-medium">{errors.postalCode.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="country" className="block text-xs font-semibold uppercase tracking-wider text-ink">
                  Country
                </label>
                <input
                  id="country"
                  type="text"
                  {...register('country')}
                  defaultValue="India"
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-sand/30 text-ink text-sm font-medium focus-ring focus:border-primary min-h-[44px]"
                />
              </div>
            </div>

            {/* Optional Map Coordinates Accordion */}
            <div className="pt-2 border-t border-border/70">
              <button
                type="button"
                onClick={() => setShowCoordinates(!showCoordinates)}
                className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary-hover focus-ring rounded py-1"
              >
                <span>{showCoordinates ? 'Hide map coordinates' : 'Add map coordinates (Optional)'}</span>
                {showCoordinates ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showCoordinates && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 pt-3 border-t border-border/50">
                  <div className="space-y-1.5">
                    <label htmlFor="latitude" className="block text-2xs font-semibold uppercase tracking-wider text-body">
                      Latitude (-90 to 90)
                    </label>
                    <input
                      id="latitude"
                      type="number"
                      step="any"
                      {...register('latitude')}
                      placeholder="12.935242"
                      className="w-full px-4 py-2 rounded-xl border border-border bg-sand/30 text-ink text-sm font-medium focus-ring min-h-[44px]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="longitude" className="block text-2xs font-semibold uppercase tracking-wider text-body">
                      Longitude (-180 to 180)
                    </label>
                    <input
                      id="longitude"
                      type="number"
                      step="any"
                      {...register('longitude')}
                      placeholder="77.624461"
                      className="w-full px-4 py-2 rounded-xl border border-border bg-sand/30 text-ink text-sm font-medium focus-ring min-h-[44px]"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 3: PHOTOS ── */}
        {currentStep === 3 && (
          <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-xs space-y-4">
            <h2 className="font-serif text-xl font-semibold text-ink flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              <span>Property Photos</span>
            </h2>
            <p className="text-body text-xs sm:text-sm">
              Upload up to 10 high-resolution photos of the building facade, entryways, reception, and shared facilities.
              Choose which image acts as the primary cover.
            </p>

            <ImageUploader
              stagedFiles={stagedPhotos}
              onStagedFilesChange={setStagedPhotos}
            />
          </div>
        )}

        {/* ── STEP 4: REVIEW & CONFIRM ── */}
        {currentStep === 4 && (
          <div className="bg-card rounded-2xl border border-border p-6 shadow-warm-xs space-y-6">
            <h2 className="font-serif text-xl font-semibold text-ink flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <span>Review Property Listing</span>
            </h2>

            <div className="divide-y divide-border border border-border rounded-xl bg-sand/30 overflow-hidden text-sm">
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-xs uppercase tracking-wider font-semibold text-body">Title</span>
                <span className="font-semibold text-ink text-right">{watch('title')}</span>
              </div>
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-xs uppercase tracking-wider font-semibold text-body">Category</span>
                <span className="font-medium text-ink">{watch('propertyType')}</span>
              </div>
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-xs uppercase tracking-wider font-semibold text-body">Address</span>
                <span className="font-medium text-ink text-right">
                  {[watch('addressLine1'), watch('addressLine2'), watch('city'), watch('state'), watch('postalCode')]
                    .filter(Boolean)
                    .join(', ')}
                </span>
              </div>
              <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="text-xs uppercase tracking-wider font-semibold text-body">Photos Staged</span>
                <span className="font-medium text-ink">{stagedPhotos.length} of 10 selected</span>
              </div>
            </div>

            {/* Upload progress message during sequential submit */}
            {uploadStatus && (
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 space-y-2">
                <div className="flex items-center gap-2 text-primary font-semibold text-xs">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Uploading photos ({uploadStatus.current} of {uploadStatus.total})...</span>
                </div>
                <div className="w-full bg-sand h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-300"
                    style={{ width: `${(uploadStatus.current / uploadStatus.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stepper Navigation Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-border gap-3">
          {currentStep > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={isSubmitting}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              className="min-h-[44px]"
            >
              Back
            </Button>
          ) : (
            <span />
          )}

          {currentStep < 4 ? (
            <Button
              type="button"
              variant="primary"
              onClick={handleNext}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="min-h-[44px]"
            >
              Next Step
            </Button>
          ) : (
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              disabled={isSubmitting}
              className="min-h-[44px]"
            >
              Create Property
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
