import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  RotateCcw,
  ArrowLeft,
  Phone,
  Send,
  X,
  Star,
  Receipt,
} from 'lucide-react';
import { api } from '../../api/client';
import { formatINR, formatKolkata, cn } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { CollapsingTitle } from '../../components/native/CollapsingTitle';
import { useToast } from '../../components/ui/Toast';

export function OwnerMaintenanceDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Modals state
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [completeCost, setCompleteCost] = useState('');
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  // Update note form state
  const [updateNote, setUpdateNote] = useState('');
  const [updatePhotoFile, setUpdatePhotoFile] = useState(null);

  // Fetch Maintenance Request details
  const {
    data: requestData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['owner-maintenance-detail', id],
    queryFn: async () => {
      const res = await api.get(`/api/maintenance-requests/${id}`);
      return res.data || res;
    },
    enabled: Boolean(id),
  });

  const request = requestData || {};
  const allowedActions = request.allowedActions || [];

  // Fetch available providers for assignment modal
  const { data: providersData } = useQuery({
    queryKey: ['verified-providers-list', request.categoryId],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (request.categoryId) {
        params.set('categoryId', request.categoryId);
      }
      const res = await api.get(`/api/providers?${params.toString()}`);
      return res.data || [];
    },
    enabled: isAssignModalOpen,
  });

  const providers = providersData || [];

  // Mutations
  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProviderId) throw new Error('Please select a service provider.');
      return await api.post(`/api/maintenance-requests/${id}/assign`, {
        providerId: selectedProviderId,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Provider Assigned',
        description: 'Work order dispatched to provider.',
        variant: 'success',
      });
      setIsAssignModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['owner-maintenance-detail', id] });
    },
    onError: (err) => {
      toast({ title: 'Assignment Failed', description: err.message, variant: 'danger' });
    },
  });

  const unassignMutation = useMutation({
    mutationFn: async () => {
      return await api.post(`/api/maintenance-requests/${id}/unassign`);
    },
    onSuccess: () => {
      toast({
        title: 'Provider Unassigned',
        description: 'Work order returned to OPEN status.',
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['owner-maintenance-detail', id] });
    },
    onError: (err) => {
      toast({ title: 'Failed to unassign', description: err.message, variant: 'danger' });
    },
  });

  const startMutation = useMutation({
    mutationFn: async () => {
      return await api.post(`/api/maintenance-requests/${id}/start`);
    },
    onSuccess: () => {
      toast({
        title: 'Work Started',
        description: 'Status advanced to IN_PROGRESS.',
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['owner-maintenance-detail', id] });
    },
    onError: (err) => {
      toast({ title: 'Failed to start', description: err.message, variant: 'danger' });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const costNum = Number(completeCost);
      if (isNaN(costNum) || costNum < 0) {
        throw new Error('Please enter a valid positive cost amount.');
      }
      return await api.post(`/api/maintenance-requests/${id}/complete`, {
        actualCost: completeCost,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Work Order Completed',
        description: 'Job marked as complete with final actual cost.',
        variant: 'success',
      });
      setIsCompleteModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['owner-maintenance-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['owner-dashboard-metrics'] });
    },
    onError: (err) => {
      toast({ title: 'Completion Failed', description: err.message, variant: 'danger' });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!cancelReason.trim() || cancelReason.trim().length < 3) {
        throw new Error('Please enter a cancellation reason (minimum 3 characters).');
      }
      return await api.post(`/api/maintenance-requests/${id}/cancel`, {
        reason: cancelReason.trim(),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Work Order Cancelled',
        description: 'Request has been cancelled.',
        variant: 'success',
      });
      setIsCancelModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['owner-maintenance-detail', id] });
    },
    onError: (err) => {
      toast({ title: 'Cancellation Failed', description: err.message, variant: 'danger' });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async () => {
      return await api.post(`/api/maintenance-requests/${id}/review`, {
        rating: Number(reviewRating),
        comment: reviewComment.trim() || null,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Review Submitted',
        description: 'Thank you for rating the service provider.',
        variant: 'success',
      });
      setIsReviewModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['owner-maintenance-detail', id] });
    },
    onError: (err) => {
      toast({ title: 'Review Failed', description: err.message, variant: 'danger' });
    },
  });

  const recordExpenseMutation = useMutation({
    mutationFn: async () => {
      return await api.post(`/api/maintenance-requests/${id}/expense`, {});
    },
    onSuccess: () => {
      toast({
        title: 'Expense Recorded',
        description: 'Maintenance actual cost automatically recorded in owner expenses ledger.',
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['owner-maintenance-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['owner-dashboard-metrics'] });
    },
    onError: (err) => {
      toast({ title: 'Expense Record Failed', description: err.message, variant: 'danger' });
    },
  });

  const addUpdateMutation = useMutation({
    mutationFn: async () => {
      if (!updateNote.trim()) throw new Error('Please enter a note.');
      const formData = new FormData();
      formData.append('note', updateNote.trim());
      if (updatePhotoFile) {
        formData.append('file', updatePhotoFile);
      }
      return await api.post(`/api/maintenance-requests/${id}/updates`, formData);
    },
    onSuccess: () => {
      toast({
        title: 'Timeline Note Added',
        description: 'Update posted to work order timeline.',
        variant: 'success',
      });
      setUpdateNote('');
      setUpdatePhotoFile(null);
      queryClient.invalidateQueries({ queryKey: ['owner-maintenance-detail', id] });
    },
    onError: (err) => {
      toast({ title: 'Failed to post note', description: err.message, variant: 'danger' });
    },
  });

  return (
    <div className="space-y-6 pb-16">
      {/* Back Link */}
      <div className="flex items-center gap-2">
        <Link
          to="/owner/maintenance"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-body hover:text-ink transition-colors min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Work Orders</span>
        </Link>
      </div>

      {/* Header */}
      <CollapsingTitle
        title={request.title || 'Work Order'}
        subtitle={
          request.property?.title
            ? `${request.property.title} - ${request.space?.title || 'Entire Property'}`
            : 'Maintenance request details and timeline.'
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {allowedActions.includes('assign') && (
              <Button
                variant="primary"
                size="md"
                onClick={() => setIsAssignModalOpen(true)}
                className="min-h-[44px]"
              >
                Assign Provider
              </Button>
            )}

            {allowedActions.includes('unassign') && (
              <Button
                variant="secondary"
                size="md"
                onClick={() => unassignMutation.mutate()}
                isLoading={unassignMutation.isPending}
                className="min-h-[44px]"
              >
                Unassign
              </Button>
            )}

            {allowedActions.includes('start') && (
              <Button
                variant="primary"
                size="md"
                onClick={() => startMutation.mutate()}
                isLoading={startMutation.isPending}
                className="min-h-[44px]"
              >
                Start Work
              </Button>
            )}

            {allowedActions.includes('complete') && (
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  setCompleteCost(request.estimatedCost || '');
                  setIsCompleteModalOpen(true);
                }}
                className="min-h-[44px]"
              >
                Complete Job
              </Button>
            )}

            {allowedActions.includes('expense') && (
              <Button
                variant="secondary"
                size="md"
                onClick={() => recordExpenseMutation.mutate()}
                isLoading={recordExpenseMutation.isPending}
                className="gap-1.5 min-h-[44px]"
              >
                <Receipt className="w-4 h-4" />
                <span>Record in Expenses</span>
              </Button>
            )}

            {allowedActions.includes('review') && (
              <Button
                variant="secondary"
                size="md"
                onClick={() => setIsReviewModalOpen(true)}
                className="gap-1.5 min-h-[44px]"
              >
                <Star className="w-4 h-4" />
                <span>Review Provider</span>
              </Button>
            )}

            {allowedActions.includes('cancel') && (
              <Button
                variant="ghost"
                size="md"
                onClick={() => setIsCancelModalOpen(true)}
                className="text-danger hover:bg-danger/10 min-h-[44px]"
              >
                Cancel Job
              </Button>
            )}
          </div>
        }
      />

      {/* Main Content */}
      {isLoading ? (
        <div className="space-y-4">
          <div className="h-32 rounded-2xl bg-sand/40 animate-pulse border border-border" />
          <div className="h-64 rounded-2xl bg-sand/40 animate-pulse border border-border" />
        </div>
      ) : isError ? (
        <div className="p-8 rounded-2xl bg-danger/10 border border-danger/30 text-center space-y-3">
          <p className="font-semibold text-danger">
            {error?.message || 'Unable to load work order details.'}
          </p>
          <Button variant="secondary" size="sm" onClick={() => refetch()} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            <span>Try Again</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Status & Overview Card */}
          <div className="p-6 rounded-2xl bg-card border border-border shadow-warm-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-wrap text-xs">
                <StatusBadge status={request.status} />
                <span className="font-medium text-body">
                  · {request.priority} Priority
                </span>
                {request.category && (
                  <span className="font-medium text-body">
                    · {request.category.name}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-6 text-xs text-body">
                <span>
                  Created: {formatKolkata(request.createdAt, 'dd MMM yyyy, hh:mm a')}
                </span>
                {request.scheduledAt && (
                  <span>
                    Scheduled: {formatKolkata(request.scheduledAt, 'dd MMM yyyy, hh:mm a')}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-body">
                Problem Description
              </h4>
              <p className="text-xs sm:text-sm text-ink leading-relaxed whitespace-pre-wrap">
                {request.description}
              </p>
            </div>

            {/* Financial Overview */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-border">
              <div>
                <span className="text-[11px] font-medium text-body block">Estimated Budget</span>
                <span className="text-sm sm:text-base font-semibold text-ink">
                  {formatINR(request.estimatedCost || '0.00')}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-medium text-body block">Final Actual Cost</span>
                <span className="text-sm sm:text-base font-semibold text-primary">
                  {request.actualCost ? formatINR(request.actualCost) : 'Pending completion'}
                </span>
              </div>
              {request.linkedExpenseId && (
                <div>
                  <span className="text-[11px] font-medium text-body block">Expense Ledger</span>
                  <span className="text-xs font-semibold text-success flex items-center gap-1 mt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Recorded
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Assigned Provider Contact Card */}
          {request.assignedProvider && (
            <div className="p-6 rounded-2xl bg-card border border-border shadow-warm-xs space-y-3">
              <h4 className="font-editorial text-lg font-bold text-ink">
                Assigned Service Provider
              </h4>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-semibold text-ink text-sm sm:text-base">
                    {request.assignedProvider.businessName}
                  </div>
                  {request.assignedProvider.bio && (
                    <p className="text-xs text-body line-clamp-2">
                      {request.assignedProvider.bio}
                    </p>
                  )}
                </div>

                {request.counterpartContact?.phone && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-sand/30 border border-border shrink-0">
                    <Phone className="w-4 h-4 text-primary" />
                    <div>
                      <span className="text-[10px] text-body block">Direct Contact</span>
                      <a
                        href={`tel:${request.counterpartContact.phone}`}
                        className="text-xs font-semibold text-ink hover:text-primary transition-colors"
                      >
                        {request.counterpartContact.phone}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timeline & Progress Updates */}
          <div className="p-6 rounded-2xl bg-card border border-border shadow-warm-xs space-y-6">
            <h4 className="font-editorial text-lg font-bold text-ink">
              Job Timeline & Progress Updates
            </h4>

            {/* Post update note */}
            {request.status !== 'COMPLETED' && request.status !== 'CANCELLED' && (
              <div className="p-4 rounded-xl bg-sand/20 border border-border space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-ink">Post Progress Update</label>
                  <textarea
                    value={updateNote}
                    onChange={(e) => setUpdateNote(e.target.value)}
                    placeholder="Describe progress, parts replaced, or site conditions..."
                    rows={2}
                    maxLength={2000}
                    className="w-full rounded-xl border border-border bg-card p-3 text-xs sm:text-sm text-ink focus:outline-none focus:border-primary resize-none"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => setUpdatePhotoFile(e.target.files?.[0] || null)}
                    className="text-xs text-body file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border file:border-border file:text-xs file:font-medium file:bg-card file:text-ink hover:file:bg-sand/30 cursor-pointer min-h-[36px]"
                  />

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => addUpdateMutation.mutate()}
                    isLoading={addUpdateMutation.isPending}
                    disabled={!updateNote.trim()}
                    className="gap-1.5 shrink-0 min-h-[36px]"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Post Update</span>
                  </Button>
                </div>
              </div>
            )}

            {/* Timeline Notes List */}
            {request.updates && request.updates.length > 0 ? (
              <div className="space-y-4">
                {request.updates.map((up) => (
                  <div
                    key={up.id}
                    className="p-4 rounded-xl border border-border bg-sand/10 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs text-body">
                      <span className="font-semibold text-ink">
                        {up.author?.name || 'Team Update'}
                      </span>
                      <span>{formatKolkata(up.createdAt, 'dd MMM yyyy, hh:mm a')}</span>
                    </div>

                    <p className="text-xs sm:text-sm text-ink whitespace-pre-wrap">
                      {up.note}
                    </p>

                    {up.mediaUrl && (
                      <div className="pt-2">
                        <img
                          src={up.mediaUrl}
                          alt="Progress evidence"
                          className="max-h-60 rounded-xl border border-border object-cover"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-body text-center py-4 border-t border-border">
                No timeline updates posted yet.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Assign Provider Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40">
          <div className="relative w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-warm-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-editorial text-xl font-bold text-ink">Assign Service Provider</h3>
                <p className="text-xs text-body">Select a certified and available partner.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="w-8 h-8 rounded-xl border border-border flex items-center justify-center text-body hover:text-ink"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-ink">Verified Provider</label>
                <select
                  value={selectedProviderId}
                  onChange={(e) => setSelectedProviderId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:border-primary min-h-[44px]"
                >
                  <option value="">Choose a certified provider</option>
                  {providers.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.businessName} - {pr.serviceAreaCity}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsAssignModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => assignMutation.mutate()}
                  isLoading={assignMutation.isPending}
                  disabled={!selectedProviderId}
                >
                  Confirm Assignment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complete Job Modal */}
      {isCompleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40">
          <div className="relative w-full max-w-sm rounded-2xl bg-card border border-border p-6 shadow-warm-lg space-y-4">
            <h3 className="font-editorial text-xl font-bold text-ink">Complete Work Order</h3>
            <p className="text-xs text-body">
              Confirm final completion and enter the verified actual cost for this repair.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-ink">Actual Cost (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={completeCost}
                onChange={(e) => setCompleteCost(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:border-primary min-h-[44px]"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsCompleteModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => completeMutation.mutate()}
                isLoading={completeMutation.isPending}
              >
                Mark Complete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Job Modal */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40">
          <div className="relative w-full max-w-sm rounded-2xl bg-card border border-border p-6 shadow-warm-lg space-y-4">
            <h3 className="font-editorial text-xl font-bold text-danger">Cancel Work Order</h3>
            <p className="text-xs text-body">
              Please provide a cancellation reason. The assigned provider will be notified.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-ink">Reason</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Work is no longer needed / owner resolved independently"
                rows={3}
                minLength={3}
                maxLength={500}
                className="w-full rounded-xl border border-border bg-card p-3 text-xs sm:text-sm text-ink focus:outline-none focus:border-primary resize-none"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsCancelModalOpen(false)}
              >
                Close
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => cancelMutation.mutate()}
                isLoading={cancelMutation.isPending}
              >
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Review Provider Modal */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40">
          <div className="relative w-full max-w-sm rounded-2xl bg-card border border-border p-6 shadow-warm-lg space-y-4">
            <h3 className="font-editorial text-xl font-bold text-ink">Rate Service Provider</h3>
            <p className="text-xs text-body">
              How was the quality of repair and timeliness of the service?
            </p>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-ink">Rating (1 to 5 Stars)</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      className={cn(
                        'w-9 h-9 rounded-xl border flex items-center justify-center transition-colors min-h-[36px]',
                        reviewRating >= star
                          ? 'border-amber bg-amber/10 text-amber'
                          : 'border-border text-body hover:bg-sand/30'
                      )}
                    >
                      <Star className="w-4 h-4 fill-current" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-ink">Comment (Optional)</label>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Share feedback on punctuality, repair quality, and tidiness..."
                  rows={3}
                  maxLength={1000}
                  className="w-full rounded-xl border border-border bg-card p-3 text-xs sm:text-sm text-ink focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsReviewModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => reviewMutation.mutate()}
                  isLoading={reviewMutation.isPending}
                >
                  Submit Review
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

