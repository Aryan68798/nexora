import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { Building, MapPin } from 'lucide-react';

export function ProviderProfilePage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    businessName: '',
    bio: '',
    serviceAreaCity: '',
    serviceAreaState: '',
    isAvailable: true,
    categoryIds: [],
  });

  const { data: profileData, isLoading: isProfileLoading } = useQuery({
    queryKey: ['providerProfile'],
    queryFn: async () => {
      try {
        const res = await api.get('/api/providers/me');
        return res?.data || res || null;
      } catch (err) {
        if (err?.status === 404) {
          return null;
        }
        throw err;
      }
    },
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['serviceCategories'],
    queryFn: async () => {
      const res = await api.get('/api/service-categories');
      return res?.data || res || [];
    },
  });

  const categories = Array.isArray(categoriesData) ? categoriesData : [];

  useEffect(() => {
    if (profileData) {
      setFormData({
        businessName: profileData.businessName || '',
        bio: profileData.bio || '',
        serviceAreaCity: profileData.serviceAreaCity || '',
        serviceAreaState: profileData.serviceAreaState || '',
        isAvailable: profileData.isAvailable !== false,
        categoryIds: Array.isArray(profileData.categories)
          ? profileData.categories.map((c) => c.id)
          : [],
      });
    }
  }, [profileData]);

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      if (profileData?.id) {
        return api.patch('/api/providers/me', payload);
      }
      return api.post('/api/providers/profile', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providerProfile'] });
      toast.success('Business profile updated successfully');
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to save business profile');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.businessName.trim()) {
      toast.error('Business name is required');
      return;
    }
    if (!formData.serviceAreaCity.trim()) {
      toast.error('Service city is required');
      return;
    }

    const payload = {
      businessName: formData.businessName.trim(),
      bio: formData.bio.trim(),
      serviceAreaCity: formData.serviceAreaCity.trim(),
      serviceAreaState: formData.serviceAreaState.trim(),
      isAvailable: formData.isAvailable,
      categoryIds: formData.categoryIds,
    };

    saveMutation.mutate(payload);
  };

  const toggleCategory = (catId) => {
    setFormData((prev) => {
      const exists = prev.categoryIds.includes(catId);
      return {
        ...prev,
        categoryIds: exists
          ? prev.categoryIds.filter((id) => id !== catId)
          : [...prev.categoryIds, catId],
      };
    });
  };

  const status = profileData?.verificationStatus || 'PENDING';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="font-editorial text-3xl font-bold text-ink">
            Business Profile &amp; Availability
          </h1>
          <p className="text-body text-sm mt-1">
            Manage your service areas, trade categories, and availability status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {status === 'VERIFIED' && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success-700">
              <span className="w-2 h-2 rounded-full bg-success" />
              Verified Provider
            </span>
          )}
          {status === 'PENDING' && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800">
              <span className="w-2 h-2 rounded-full bg-amber" />
              Verification Pending
            </span>
          )}
          {status === 'REJECTED' && (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-danger">
              <span className="w-2 h-2 rounded-full bg-danger" />
              Application Rejected
            </span>
          )}
        </div>
      </div>

      {isProfileLoading ? (
        <Card className="p-8 text-center text-body">Loading profile details...</Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="p-6 space-y-5 bg-card border border-border rounded-xl">
            <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
              <Building className="w-5 h-5 text-primary" />
              Company Information
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">
                  Business Name *
                </label>
                <Input
                  value={formData.businessName}
                  onChange={(e) =>
                    setFormData({ ...formData, businessName: e.target.value })
                  }
                  placeholder="e.g. Apex Maintenance & Plumbing"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">
                  Availability for Work
                </label>
                <div className="flex items-center h-10 px-3 border border-border rounded-xl bg-sand/30">
                  <label className="flex items-center gap-2.5 cursor-pointer text-sm text-ink font-medium select-none">
                    <input
                      type="checkbox"
                      checked={formData.isAvailable}
                      onChange={(e) =>
                        setFormData({ ...formData, isAvailable: e.target.checked })
                      }
                      className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                    />
                    Accepting new work requests
                  </label>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                Professional Bio &amp; Qualifications
              </label>
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 text-sm text-ink bg-card border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Describe your team skills, certifications, and experience..."
              />
            </div>
          </Card>

          <Card className="p-6 space-y-5 bg-card border border-border rounded-xl">
            <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              Service Territory
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">
                  City *
                </label>
                <Input
                  value={formData.serviceAreaCity}
                  onChange={(e) =>
                    setFormData({ ...formData, serviceAreaCity: e.target.value })
                  }
                  placeholder="e.g. Bengaluru"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">
                  State / Region
                </label>
                <Input
                  value={formData.serviceAreaState}
                  onChange={(e) =>
                    setFormData({ ...formData, serviceAreaState: e.target.value })
                  }
                  placeholder="e.g. Karnataka"
                />
              </div>
            </div>
          </Card>

          <Card className="p-6 space-y-4 bg-card border border-border rounded-xl">
            <h2 className="text-lg font-semibold text-ink">
              Specialized Service Categories
            </h2>
            <p className="text-sm text-body">
              Select all trade categories your business provides on-site.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              {categories.map((cat) => {
                const isChecked = formData.categoryIds.includes(cat.id);
                return (
                  <button
                    type="button"
                    key={cat.id}
                    onClick={() => toggleCategory(cat.id)}
                    className={`flex items-center gap-2 p-3 text-left border rounded-xl transition-colors ${isChecked
                      ? 'border-primary bg-primary/5 text-ink'
                      : 'border-border bg-card text-body hover:bg-sand/40'
                      }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => { }}
                      className="rounded border-border text-primary focus:ring-primary w-4 h-4 pointer-events-none"
                    />
                    <span className="text-sm font-medium">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </Card>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="primary"
              disabled={saveMutation.isPending}
              className="px-6 py-2.5 rounded-xl font-medium"
            >
              {saveMutation.isPending ? 'Saving Profile...' : 'Save Profile Changes'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export default ProviderProfilePage;

