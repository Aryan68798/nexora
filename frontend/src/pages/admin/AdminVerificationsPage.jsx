import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { formatKolkata } from '../../lib/utils';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Card } from '../../components/ui/Card';
import {
  User,
  MapPin,
  Tag,
} from 'lucide-react';

export function AdminVerificationsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [actionType, setActionType] = useState(null); // 'VERIFIED' | 'REJECTED'
  const [reviewNote, setReviewNote] = useState('');

  const { data: providersData, isLoading, error } = useQuery({
    queryKey: ['adminProviders', statusFilter],
    queryFn: async () => {
      const url =
        statusFilter === 'ALL'
          ? '/api/admin/providers'
          : `/api/admin/providers?verificationStatus=${statusFilter}`;
      const res = await api.get(url);
      return res?.data || res || [];
    },
  });

  const providers = Array.isArray(providersData) ? providersData : [];

  const verifyMutation = useMutation({
    mutationFn: async ({ id, status, note }) => {
      return api.patch(`/api/admin/providers/${id}/verification`, {
        status,
        note: note || undefined,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['adminProviders'] });
      queryClient.invalidateQueries({ queryKey: ['adminDashboard'] });
      const actionLabel = variables.status === 'VERIFIED' ? 'approved' : 'rejected';
      toast.success(`Provider application ${actionLabel} successfully.`);
      closeModal();
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to update verification status');
    },
  });

  const openModal = (provider, type) => {
    setSelectedProvider(provider);
    setActionType(type);
    setReviewNote(
      type === 'VERIFIED'
        ? 'Trade credentials and documentation verified.'
        : 'Application does not meet current verification requirements.'
    );
  };

  const closeModal = () => {
    setSelectedProvider(null);
    setActionType(null);
    setReviewNote('');
  };

  const handleConfirmAction = () => {
    if (!selectedProvider || !actionType) return;
    verifyMutation.mutate({
      id: selectedProvider.id,
      status: actionType,
      note: reviewNote.trim(),
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="font-editorial text-3xl font-bold text-ink">
            Provider Verification Queue
          </h1>
          <p className="text-body text-sm mt-1">
            Review service provider registrations, inspect licenses, and approve or decline directory listings.
          </p>
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 p-1 bg-sand/50 border border-border rounded-xl">
          {['ALL', 'PENDING', 'VERIFIED', 'REJECTED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${statusFilter === st
                ? 'bg-card text-ink shadow-sm'
                : 'text-body hover:text-ink'
                }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Card className="p-12 text-center text-body">Loading verification queue...</Card>
      ) : error ? (
        <Card className="p-8 text-center text-danger border-danger/30">
          Failed to load provider verification applications.
        </Card>
      ) : providers.length === 0 ? (
        <Card className="p-12 text-center text-body">
          No provider applications found for the selected status.
        </Card>
      ) : (
        <div className="space-y-4">
          {providers.map((p) => {
            const categories = Array.isArray(p.categories)
              ? p.categories.map((c) => c.name).join(', ')
              : 'General Maintenance';

            return (
              <Card
                key={p.id}
                className="p-6 bg-card border border-border rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-5 transition-shadow hover:shadow-sm"
              >
                <div className="space-y-2.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-lg font-bold text-ink truncate">
                      {p.businessName}
                    </h2>

                    <StatusBadge status={p.verificationStatus} />
                  </div>

                  <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-body">
                    {p.user && (
                      <span className="flex items-center gap-1.5 text-ink font-medium">
                        <User className="w-3.5 h-3.5 text-body" />
                        {p.user.name} ({p.user.email})
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-body" />
                      {p.serviceAreaCity || 'Not specified'}
                      {p.serviceAreaState ? `, ${p.serviceAreaState}` : ''}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-body" />
                      {categories}
                    </span>
                    {p.createdAt && (
                      <span className="text-body/80">
                        Applied: {formatKolkata(p.createdAt)}
                      </span>
                    )}
                  </div>

                  {p.bio && (
                    <p className="text-sm text-body line-clamp-2 pt-1 border-t border-border/50">
                      {p.bio}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2.5 pt-2 md:pt-0 border-t md:border-t-0 border-border/60">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openModal(p, 'REJECTED')}
                    disabled={p.verificationStatus === 'REJECTED'}
                    className="px-3.5 py-2 text-xs font-semibold text-danger border-border hover:bg-danger/10 rounded-xl"
                  >
                    Reject
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => openModal(p, 'VERIFIED')}
                    disabled={p.verificationStatus === 'VERIFIED'}
                    className="px-4 py-2 text-xs font-semibold rounded-xl"
                  >
                    Approve
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Decision Modal */}
      {selectedProvider && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40">
          <div className="w-full max-w-md bg-card border border-border rounded-xl p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-ink">
              {actionType === 'VERIFIED' ? 'Approve Provider Application' : 'Reject Provider Application'}
            </h3>
            <p className="text-sm text-body">
              Confirm decision for <strong className="text-ink">{selectedProvider.businessName}</strong>. An in-app notification will be sent to the provider.
            </p>

            <div>
              <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1.5">
                Review Notes / Reason
              </label>
              <textarea
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm text-ink bg-card border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Enter feedback or confirmation details..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeModal}
                disabled={verifyMutation.isPending}
                className="px-4 py-2 text-xs rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant={actionType === 'VERIFIED' ? 'primary' : 'danger'}
                onClick={handleConfirmAction}
                disabled={verifyMutation.isPending}
                className="px-4 py-2 text-xs rounded-xl"
              >
                {verifyMutation.isPending
                  ? 'Saving...'
                  : actionType === 'VERIFIED'
                    ? 'Confirm Approval'
                    : 'Confirm Rejection'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminVerificationsPage;
