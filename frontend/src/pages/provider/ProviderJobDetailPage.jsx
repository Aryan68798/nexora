import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  RotateCcw,
  ArrowLeft,
  Phone,
  Send,
  MapPin,
  Play,
} from 'lucide-react';
import { api } from '../../api/client';
import { formatINR, formatKolkata } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { CollapsingTitle } from '../../components/native/CollapsingTitle';
import { useToast } from '../../components/ui/Toast';

export function ProviderJobDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [completeCost, setCompleteCost] = useState('');
  const [isDeclineModalOpen, setIsDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  // Update note form state
  const [updateNote, setUpdateNote] = useState('');
  const [updatePhotoFile, setUpdatePhotoFile] = useState(null);

  // Fetch job details
  const {
    data: jobData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['provider-job-detail', id],
    queryFn: async () => {
      const res = await api.get(`/api/maintenance-requests/${id}`);
      return res.data || res;
    },
    enabled: Boolean(id),
  });

  const job = jobData || {};
  const isAssigned = job.status === 'ASSIGNED';
  const isInProgress = job.status === 'IN_PROGRESS';
  const isCompleted = job.status === 'COMPLETED';

  // Mutations
  const startMutation = useMutation({
    mutationFn: async () => {
      return await api.post(`/api/maintenance-requests/${id}/start`);
    },
    onSuccess: () => {
      toast({
        title: 'Work Started',
        description: 'Status advanced to IN_PROGRESS. Owner has been notified.',
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['provider-job-detail', id] });
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
        description: 'Job completed with final actual cost recorded.',
        variant: 'success',
      });
      setIsCompleteModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['provider-job-detail', id] });
    },
    onError: (err) => {
      toast({ title: 'Failed to complete', description: err.message, variant: 'danger' });
    },
  });

  const declineMutation = useMutation({
    mutationFn: async () => {
      if (!declineReason.trim() || declineReason.trim().length < 3) {
        throw new Error('Please enter a reason for declining (minimum 3 characters).');
      }
      return await api.post(`/api/maintenance-requests/${id}/decline`, {
        reason: declineReason.trim(),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Job Declined',
        description: 'Work order returned to owner for redispatch.',
        variant: 'secondary',
      });
      setIsDeclineModalOpen(false);
      navigate('/provider/jobs');
    },
    onError: (err) => {
      toast({ title: 'Decline Failed', description: err.message, variant: 'danger' });
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
        title: 'Update Posted',
        description: 'On-site progress note shared with property owner.',
        variant: 'success',
      });
      setUpdateNote('');
      setUpdatePhotoFile(null);
      queryClient.invalidateQueries({ queryKey: ['provider-job-detail', id] });
    },
    onError: (err) => {
      toast({ title: 'Update Failed', description: err.message, variant: 'danger' });
    },
  });

  return (
    <div className="space-y-6 pb-16">
      {/* Back Link */}
      <div className="flex items-center gap-2">
        <Link
          to="/provider/jobs"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-body hover:text-ink transition-colors min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Job Board</span>
        </Link>
      </div>

      {/* Header */}
      <CollapsingTitle
        title={job.title || 'Work Order'}
        subtitle={
          job.property?.title
            ? `${job.property.title} - ${job.property.city || ''}`
            : 'Service visit instructions and details.'
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {isAssigned && (
              <>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => startMutation.mutate()}
                  isLoading={startMutation.isPending}
                  className="gap-1.5 min-h-[44px]"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start Work</span>
                </Button>

                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setIsDeclineModalOpen(true)}
                  className="text-danger hover:bg-danger/10 min-h-[44px]"
                >
                  Decline Job
                </Button>
              </>
            )}

            {isInProgress && (
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  setCompleteCost(job.estimatedCost || '');
                  setIsCompleteModalOpen(true);
                }}
                className="gap-1.5 min-h-[44px]"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mark Job Complete</span>
              </Button>
            )}
          </div>
        }
      />

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          <div className="h-32 rounded-2xl bg-sand/40 animate-pulse border border-border" />
          <div className="h-64 rounded-2xl bg-sand/40 animate-pulse border border-border" />
        </div>
      ) : isError ? (
        <div className="p-8 rounded-2xl bg-danger/10 border border-danger/30 text-center space-y-3">
          <p className="font-semibold text-danger">
            {error?.message || 'Unable to load job details.'}
          </p>
          <Button variant="secondary" size="sm" onClick={() => refetch()} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            <span>Try Again</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Status & Site Details */}
          <div className="p-6 rounded-2xl bg-card border border-border shadow-warm-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-wrap text-xs">
                <StatusBadge status={job.status} />
                {job.priority === 'URGENT' && (
                  <span className="font-semibold text-danger">
                    Urgent Priority
                  </span>
                )}
                {job.category && (
                  <span className="text-body font-medium">
                    · {job.category.name}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-6 text-xs text-body">
                {job.scheduledAt && (
                  <span>
                    Appointment: {formatKolkata(job.scheduledAt, 'dd MMM yyyy, hh:mm a')}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-border">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-body">
                Site & Property Location
              </h4>
              <p className="text-sm font-semibold text-ink">
                {job.property?.title} {job.space ? `- Space: ${job.space.title}` : ''}
              </p>
              {job.property?.address && (
                <p className="text-xs text-body flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {job.property.address}, {job.property.city}
                </p>
              )}
            </div>

            <div className="space-y-1.5 pt-2 border-t border-border">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-body">
                Service Scope & Problem Statement
              </h4>
              <p className="text-xs sm:text-sm text-ink leading-relaxed whitespace-pre-wrap">
                {job.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
              <div>
                <span className="text-[11px] font-medium text-body block">Estimated Budget</span>
                <span className="text-sm sm:text-base font-semibold text-ink">
                  {formatINR(job.estimatedCost || '0.00')}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-medium text-body block">Final Actual Cost</span>
                <span className="text-sm sm:text-base font-semibold text-primary">
                  {job.actualCost ? formatINR(job.actualCost) : 'Pending completion'}
                </span>
              </div>
            </div>
          </div>

          {/* Owner Direct Contact Card */}
          {job.counterpartContact?.phone && (
            <div className="p-6 rounded-2xl bg-card border border-border shadow-warm-xs flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-xs font-medium text-body block">Property Owner Contact</span>
                <p className="text-sm font-semibold text-ink">Site Access Coordinator</p>
              </div>

              <a
                href={`tel:${job.counterpartContact.phone}`}
                className="flex items-center gap-2 p-3 rounded-xl bg-sand/40 border border-border text-primary font-semibold text-xs sm:text-sm hover:bg-sand/60 transition-colors min-h-[44px]"
              >
                <Phone className="w-4 h-4" />
                <span>{job.counterpartContact.phone}</span>
              </a>
            </div>
          )}

          {/* Timeline & On-Site Notes */}
          <div className="p-6 rounded-2xl bg-card border border-border shadow-warm-xs space-y-6">
            <h4 className="font-editorial text-lg font-bold text-ink">
              Job Timeline & Progress Notes
            </h4>

            {/* Post progress note */}
            {!isCompleted && job.status !== 'CANCELLED' && (
              <div className="p-4 rounded-xl bg-sand/20 border border-border space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-ink">
                    Add Site Note or Photo
                  </label>
                  <textarea
                    value={updateNote}
                    onChange={(e) => setUpdateNote(e.target.value)}
                    placeholder="Log parts replaced, diagnostic findings, or site photos..."
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

            {/* Notes List */}
            {job.updates && job.updates.length > 0 ? (
              <div className="space-y-4">
                {job.updates.map((up) => (
                  <div
                    key={up.id}
                    className="p-4 rounded-xl border border-border bg-sand/10 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs text-body">
                      <span className="font-semibold text-ink">
                        {up.author?.name || 'Progress Log'}
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
                No progress notes logged yet.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Complete Job Modal */}
      {isCompleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40">
          <div className="relative w-full max-w-sm rounded-2xl bg-card border border-border p-6 shadow-warm-lg space-y-4">
            <h3 className="font-editorial text-xl font-bold text-ink">Complete Service Visit</h3>
            <p className="text-xs text-body">
              Confirm resolution of repair and specify the final total actual cost.
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

      {/* Decline Job Modal */}
      {isDeclineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40">
          <div className="relative w-full max-w-sm rounded-2xl bg-card border border-border p-6 shadow-warm-lg space-y-4">
            <h3 className="font-editorial text-xl font-bold text-danger">Decline Work Order</h3>
            <p className="text-xs text-body">
              Provide a reason for declining this request so the owner can reassign.
            </p>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-ink">Reason</label>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="e.g. Schedule conflict with emergency inspections"
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
                onClick={() => setIsDeclineModalOpen(false)}
              >
                Keep Job
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => declineMutation.mutate()}
                isLoading={declineMutation.isPending}
              >
                Confirm Decline
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
