import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardCheck,
  Calendar,
  Plus,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { api } from '../../api/client';
import { formatKolkata, cn } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { CollapsingTitle } from '../../components/native/CollapsingTitle';
import { useToast } from '../../components/ui/Toast';

const STATUS_TABS = [
  { id: 'ALL', label: 'All Inspections' },
  { id: 'SCHEDULED', label: 'Scheduled' },
  { id: 'IN_PROGRESS', label: 'In Progress' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

export function OwnerInspectionsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('ALL');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  // Form state for scheduling
  const [schedulePropertyId, setSchedulePropertyId] = useState('');
  const [scheduledAtDate, setScheduledAtDate] = useState('');
  const [scheduledAtTime, setScheduledAtTime] = useState('10:00');
  const [summary, setSummary] = useState('');
  const [formError, setFormError] = useState('');

  // Fetch properties for selector
  const { data: propertiesData } = useQuery({
    queryKey: ['owner-properties-list-minimal'],
    queryFn: async () => {
      const res = await api.get('/api/properties/mine');
      return res.data || res || [];
    },
  });

  const properties = React.useMemo(() => propertiesData || [], [propertiesData]);

  // Set default schedule property once loaded
  React.useEffect(() => {
    if (properties.length > 0 && !schedulePropertyId) {
      setSchedulePropertyId(properties[0].id);
    }
  }, [properties, schedulePropertyId]);

  // Fetch inspections across selected property or query all properties
  const targetPropertyId = selectedPropertyId || (properties.length > 0 ? properties[0].id : null);

  const {
    data: inspectionsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['owner-inspections', targetPropertyId, activeTab],
    queryFn: async () => {
      if (!targetPropertyId) return [];
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (activeTab !== 'ALL') {
        params.set('status', activeTab);
      }
      const res = await api.get(`/api/properties/${targetPropertyId}/inspections?${params.toString()}`);
      return res.data || [];
    },
    enabled: Boolean(targetPropertyId),
  });

  const inspections = inspectionsData || [];

  // Schedule inspection mutation
  const scheduleMutation = useMutation({
    mutationFn: async (payload) => {
      return await api.post(`/api/properties/${payload.propertyId}/inspections`, {
        scheduledAt: payload.scheduledAt,
        summary: payload.summary || undefined,
      });
    },
    onSuccess: (data) => {
      toast({
        title: 'Inspection Scheduled',
        description: 'New property inspection has been successfully scheduled.',
        variant: 'success',
      });
      setIsScheduleModalOpen(false);
      setSummary('');
      queryClient.invalidateQueries({ queryKey: ['owner-inspections'] });
      queryClient.invalidateQueries({ queryKey: ['owner-dashboard-metrics'] });
      if (data?.data?.id) {
        navigate(`/owner/inspections/${data.data.id}`);
      }
    },
    onError: (err) => {
      setFormError(err.message || 'Failed to schedule inspection');
    },
  });

  const handleScheduleSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    if (!schedulePropertyId) {
      setFormError('Please select a property.');
      return;
    }
    if (!scheduledAtDate) {
      setFormError('Please select a date.');
      return;
    }

    try {
      const combinedDateTime = new Date(`${scheduledAtDate}T${scheduledAtTime}:00`);
      if (isNaN(combinedDateTime.getTime())) {
        setFormError('Invalid date or time.');
        return;
      }
      if (combinedDateTime.getTime() < Date.now()) {
        setFormError('Scheduled time must be in the future.');
        return;
      }

      scheduleMutation.mutate({
        propertyId: schedulePropertyId,
        scheduledAt: combinedDateTime.toISOString(),
        summary: summary.trim() || undefined,
      });
    } catch {
      setFormError('Invalid date or time format.');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Title & Actions */}
      <CollapsingTitle
        title="Property Inspections"
        subtitle="Checklist reviews, physical condition tracking, and asset health grades."
        actions={
          <div className="flex items-center gap-3">
            {properties.length > 0 && (
              <select
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                aria-label="Filter by property"
                className="appearance-none rounded-xl border border-border bg-card px-4 py-2 text-xs sm:text-sm font-medium text-ink focus:outline-none focus:border-primary shadow-warm-xs min-h-[44px] cursor-pointer"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            )}

            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setFormError('');
                setIsScheduleModalOpen(true);
              }}
              className="gap-2 shrink-0 min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule Inspection</span>
            </Button>
          </div>
        }
      />

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar border-b border-border">
        {STATUS_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-2 text-xs sm:text-sm font-medium transition-colors border-b-2 whitespace-nowrap min-h-[44px]',
                isActive
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-body hover:text-ink'
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content State */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-28 rounded-2xl bg-sand/40 animate-pulse border border-border/50" />
          ))}
        </div>
      ) : isError ? (
        <div className="p-8 rounded-2xl bg-danger/10 border border-danger/30 text-center space-y-3">
          <p className="font-semibold text-danger">
            {error?.message || 'Unable to load property inspections.'}
          </p>
          <Button variant="secondary" size="sm" onClick={() => refetch()} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            <span>Try Again</span>
          </Button>
        </div>
      ) : inspections.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card space-y-3">
          <div className="w-12 h-12 rounded-xl bg-sand/60 text-body flex items-center justify-center mx-auto">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <h3 className="font-sans font-semibold text-ink text-base">No inspections found</h3>
          <p className="text-body text-xs sm:text-sm max-w-md mx-auto">
            {activeTab === 'ALL'
              ? 'No inspection records exist for this property yet. Schedule your first physical inspection checklist.'
              : `No inspections found with status ${activeTab.toLowerCase()}.`}
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsScheduleModalOpen(true)}
            className="mt-2 min-h-[44px]"
          >
            Schedule Inspection
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {inspections.map((insp) => {
            const hasScore = insp.score !== null && insp.score !== undefined;
            return (
              <Link
                key={insp.id}
                to={`/owner/inspections/${insp.id}`}
                className="block p-5 rounded-2xl bg-card border border-border hover:border-primary/40 hover:shadow-warm-sm transition-all group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-sans font-semibold text-ink text-sm sm:text-base">
                        Inspection #{insp.id.slice(0, 8)}
                      </span>
                      <Badge
                        variant={
                          insp.status === 'COMPLETED'
                            ? 'success'
                            : insp.status === 'IN_PROGRESS'
                              ? 'warning'
                              : insp.status === 'CANCELLED'
                                ? 'danger'
                                : 'neutral'
                        }
                      >
                        {insp.status}
                      </Badge>
                      {hasScore && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              insp.grade === 'A' || insp.grade === 'B'
                                ? 'bg-success'
                                : insp.grade === 'C'
                                  ? 'bg-warning'
                                  : 'bg-danger'
                            }`}
                          />
                          Grade {insp.grade || 'N/A'} ({insp.score}/100)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-body flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-body" />
                        {insp.scheduledAt ? formatKolkata(insp.scheduledAt, 'dd MMM yyyy, hh:mm a') : 'Unscheduled'}
                      </span>
                      {insp.completedAt && (
                        <span className="flex items-center gap-1 text-success">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Completed on {formatKolkata(insp.completedAt, 'dd MMM yyyy')}
                        </span>
                      )}
                    </div>

                    {insp.summary && (
                      <p className="text-xs text-body line-clamp-1 mt-1 max-w-xl">
                        {insp.summary}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <span className="text-xs font-medium text-primary flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      <span>View Checklist</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Schedule Modal */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40">
          <div className="relative w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-warm-lg space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-editorial text-xl font-bold text-ink">Schedule Inspection</h3>
                <p className="text-xs text-body">Create a new inspection appointment.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="w-8 h-8 rounded-xl border border-border flex items-center justify-center text-body hover:text-ink hover:bg-sand/30 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-xs text-danger font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-ink">Select Property</label>
                <select
                  value={schedulePropertyId}
                  onChange={(e) => setSchedulePropertyId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:border-primary min-h-[44px]"
                  required
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} - {p.city}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-ink">Inspection Date</label>
                  <input
                    type="date"
                    value={scheduledAtDate}
                    onChange={(e) => setScheduledAtDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:border-primary min-h-[44px]"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-ink">Inspection Time</label>
                  <input
                    type="time"
                    value={scheduledAtTime}
                    onChange={(e) => setScheduledAtTime(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:border-primary min-h-[44px]"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-ink">
                  Summary / Scope Notes (Optional)
                </label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="e.g. Pre-monsoon roof inspection and electrical verification."
                  rows={3}
                  maxLength={1000}
                  className="w-full rounded-xl border border-border bg-card p-3 text-xs sm:text-sm text-ink placeholder:text-body/60 focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsScheduleModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={scheduleMutation.isPending}
                >
                  Confirm Schedule
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

