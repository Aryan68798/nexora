import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Camera, Check, ShieldCheck, User, Phone, Mail, Award, Smartphone } from 'lucide-react';
import { useAuth } from '../../features/auth/useAuth';
import { Input } from '../../components/ui/Input';
import { FormField } from '../../components/ui/FormField';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Switch } from '../../components/ui/Switch';
import { useToast } from '../../components/ui/Toast';
import { isHapticsEnabled, setHapticsEnabled, haptics } from '../../lib/haptics';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z
    .string()
    .regex(/^(\+91)?[6-9]\d{9}$/, 'Enter a valid Indian phone number (+91...)')
    .or(z.literal(''))
    .optional(),
});

/**
 * User Profile & Settings Page
 */
export function ProfilePage() {
  const { profile, role, updateProfile, uploadAvatar } = useAuth();
  const { addToast } = useToast();
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [hapticsEnabled, setHapticsEnabledState] = useState(() => isHapticsEnabled());

  const handleHapticsToggle = (enabled) => {
    setHapticsEnabledState(enabled);
    setHapticsEnabled(enabled);
    if (enabled) {
      haptics.success();
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: profile?.name || '',
      phone: profile?.phone || '',
    },
  });

  const onSubmit = async (values) => {
    try {
      await updateProfile({
        name: values.name,
        phone: values.phone || undefined,
      });
      reset(values);
      addToast({
        title: 'Profile Updated',
        message: 'Your personal details have been saved successfully.',
        variant: 'success',
      });
    } catch (err) {
      addToast({
        title: 'Update Failed',
        message: err.message || 'Unable to update profile',
        variant: 'danger',
      });
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      addToast({
        title: 'File Too Large',
        message: 'Avatar image must be under 2 MB.',
        variant: 'warning',
      });
      return;
    }

    setUploadingAvatar(true);
    try {
      await uploadAvatar(file);
      addToast({
        title: 'Avatar Updated',
        message: 'Your portrait has been saved.',
        variant: 'success',
      });
    } catch (err) {
      addToast({
        title: 'Upload Failed',
        message: err.message || 'Unable to upload image',
        variant: 'danger',
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="font-serif text-3xl md:text-4xl font-bold text-ink mb-2">
          Account & Profile
        </h1>
        <p className="text-body text-sm md:text-base">
          Manage your personal details, verification credentials, and notifications.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Avatar & Role Summary */}
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="relative inline-block mx-auto mb-4">
                <Avatar
                  name={profile?.name || 'User'}
                  src={profile?.avatar_url}
                  size="xl"
                  className="ring-4 ring-primary/20"
                />
                <label
                  htmlFor="avatar-upload"
                  className="absolute bottom-0 right-0 w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center cursor-pointer shadow-warm-sm hover:bg-primary-hover transition-colors focus-ring"
                  title="Upload new portrait"
                >
                  <Camera className="w-4 h-4" />
                  <input
                    id="avatar-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={handleAvatarChange}
                    disabled={uploadingAvatar}
                  />
                </label>
              </div>

              <h2 className="font-serif text-xl font-bold text-ink">
                {profile?.name}
              </h2>
              <p className="text-xs text-body mb-3">{profile?.email}</p>

              <div className="inline-flex items-center gap-2.5 text-xs">
                <span className="font-semibold text-primary uppercase tracking-wider">
                  {role}
                </span>
                {profile?.is_active && (
                  <span className="inline-flex items-center gap-1 text-success-700 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-success" />
                    Active
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Provider Specific Metadata Card */}
          {profile?.serviceProvider && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Award className="w-4 h-4 text-primary" />
                  Service Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2 text-body">
                <div>
                  <span className="font-semibold text-ink">Business: </span>
                  {profile.serviceProvider.business_name || 'Independent Provider'}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-ink">Status: </span>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        profile.serviceProvider.is_verified ? 'bg-success' : 'bg-warning'
                      }`}
                    />
                    {profile.serviceProvider.is_verified ? 'Verified' : 'Pending Verification'}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Editable Details */}
        <div className="md:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Personal Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
                <FormField label="Full Name" error={errors.name?.message} required>
                  <Input
                    leftIcon={<User className="w-4 h-4" />}
                    hasError={Boolean(errors.name)}
                    {...register('name')}
                  />
                </FormField>

                <FormField
                  label="Email Address"
                  hint="Email cannot be changed directly. Contact support if needed."
                >
                  <Input
                    type="email"
                    leftIcon={<Mail className="w-4 h-4" />}
                    value={profile?.email || ''}
                    disabled
                    readOnly
                    className="bg-sand text-body cursor-not-allowed"
                  />
                </FormField>

                <FormField
                  label="Phone Number"
                  hint="Phone format: +919876543210. Only shared on active assigned maintenance jobs."
                  error={errors.phone?.message}
                >
                  <Input
                    type="tel"
                    leftIcon={<Phone className="w-4 h-4" />}
                    placeholder="+919876543210"
                    hasError={Boolean(errors.phone)}
                    {...register('phone')}
                  />
                </FormField>

                <div className="pt-4 flex items-center justify-between border-t border-border">
                  <span className="text-xs text-body flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    Backed by Nexora Security
                  </span>

                  <Button
                    type="submit"
                    variant="primary"
                    disabled={!isDirty || isSubmitting}
                    loading={isSubmitting}
                    leftIcon={<Check className="w-4 h-4" />}
                  >
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Native Preferences Card: Haptic feedback toggle */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-primary" />
                Device Preferences
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <label htmlFor="haptics-switch" className="text-sm font-medium text-ink cursor-pointer">
                    Haptic Feedback
                  </label>
                  <p className="text-xs text-body">
                    Subtle physical vibration upon tapping interactive buttons, opening sheets, and confirming actions.
                  </p>
                </div>
                <Switch
                  id="haptics-switch"
                  checked={hapticsEnabled}
                  onChange={handleHapticsToggle}
                  aria-label="Toggle haptic feedback"
                />
              </div>
              <p className="text-2xs text-body border-t border-border pt-3 leading-relaxed">
                Haptic feedback uses <code className="text-ink">navigator.vibrate</code>. Note: iOS Safari does not support web vibration.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
