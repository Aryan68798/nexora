import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wrench,
  Calendar,
  Building,
  Plus,
  ArrowRight,
  RotateCcw,
  AlertCircle,
  X,
  User,
} from 'lucide-react';
import { api } from '../../api/client';
import { formatINR, formatKolkata, cn } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { CollapsingTitle } from '../../components/native/CollapsingTitle';
import { useToast } from '../../components/ui/Toast';

const STATUS_TABS = [
  { id: 'ALL', label: 'All Jobs' },
  { id: 'OPEN', label: 'Open' },
  { id: 'ASSIGNED', label: 'Assigned' },
  { id: 'IN_PROGRESS', label: 'In Progress' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'CANCELLED', label: 'Cancelled' },
];

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

function getPriorityBadgeVariant(priority) {
  switch (priority) {
    case 'URGENT':
      return 'danger';
    case 'HIGH':
      return 'warning';
    case 'MEDIUM':
      return 'neutral';
    case 'LOW':
      return 'secondary';
    default:
      return 'secondary';
  }
}

function getStatusBadgeVariant(status) {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'IN_PROGRESS':
      return 'warning';
    case 'ASSIGNED':
      return 'neutral';
    case 'OPEN':
      return 'secondary';
    case 'CANCELLED':
      return 'danger';
    default:
      return 'secondary';
  }
}

export function OwnerMaintenancePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState('ALL');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedPriority, setSelectedPriority] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // New request form states
  const [createPropertyId, setCreatePropertyId] = useState('');
  const [createSpaceId, setCreateSpaceId] = useState('');
  const [createCategoryId, setCreateCategoryId] = useState('');
  const [createTitle, setCreateTitle] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createPriority, setCreatePriority] = useState('MEDIUM');
  const [createEstimatedCost, setCreateEstimatedCost] = useState('');
  const [createScheduledDate, setCreateScheduledDate] = useState('');
  const createScheduledTime = '10:00';
  const [formError, setFormError] = useState('');

  // Fetch properties for dropdown
  const { data: propertiesData } = useQuery({
    queryKey: ['owner-properties-list-minimal'],
    queryFn: async () => {
      const res = await api.get('/api/properties/mine');
      return res.data || res || [];
    },
  });

  const properties = React.useMemo(() => propertiesData || [], [propertiesData]);

  // Initialize selected create property
  React.useEffect(() => {
    if (properties.length > 0 && !createPropertyId) {
      setCreatePropertyId(properties[0].id);
    }
  }, [properties, createPropertyId]);

  // Fetch service categories
  const { data: categoriesData } = useQuery({
    queryKey: ['service-categories'],
    queryFn: async () => {
      const res = await api.get('/api/service-categories');
      return res.data || [];
    },
  });

  const categories = categoriesData || [];

  // Fetch spaces for the selected property in the modal
  const { data: spacesData } = useQuery({
    queryKey: ['property-spaces', createPropertyId],
    queryFn: async () => {
      if (!createPropertyId) return [];
      const res = await api.get(`/api/properties/${createPropertyId}`);
      return res.data?.spaces || [];
    },
    enabled: Boolean(createPropertyId),
  });

  const propertySpaces = spacesData || [];

  // Fetch maintenance requests
  const {
    data: requestsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['owner-maintenance-requests', activeTab, selectedPropertyId, selectedPriority],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (activeTab !== 'ALL') {
        params.set('status', activeTab);
      }
      if (selectedPropertyId) {
        params.set('propertyId', selectedPropertyId);
      }
      if (selectedPriority) {
        params.set('priority', selectedPriority);
      }
      const res = await api.get(`/api/maintenance-requests?${params.toString()}`);
      return res.data || [];
    },
  });

  const requests = requestsData || [];

  // Create request mutation
  const createMutation = useMutation({
    mutationFn: async (payload) => {
      return await api.post('/api/maintenance-requests', payload);
    },
    onSuccess: (res) => {
      toast({
        title: 'Work Order Created',
        description: 'New maintenance request has been submitted.',
        variant: 'success',
      });
      setIsCreateModalOpen(false);
      setCreateTitle('');
      setCreateDescription('');
      setCreateEstimatedCost('');
      setCreateScheduledDate('');
      setFormError('');
      queryClient.invalidateQueries({ queryKey: ['owner-maintenance-requests'] });
      queryClient.invalidateQueries({ queryKey: ['owner-dashboard-metrics'] });
      if (res?.data?.id) {
        navigate(`/owner/maintenance/${res.data.id}`);
      }
    },
    onError: (err) => {
      setFormError(err.message || 'Failed to create maintenance request');
    },
  });

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    if (!createPropertyId) {
      setFormError('Please select a property.');
      return;
    }
    if (!createTitle.trim() || createTitle.trim().length < 3) {
      setFormError('Title must be at least 3 characters.');
      return;
    }
    if (!createDescription.trim() || createDescription.trim().length < 5) {
      setFormError('Description must be at least 5 characters.');
      return;
    }

    let scheduledAt = null;
    if (createScheduledDate) {
      const combined = new Date(`${createScheduledDate}T${createScheduledTime}:00`);
      if (isNaN(combined.getTime())) {
        setFormError('Invalid scheduled date or time.');
        return;
      }
      if (combined.getTime() < Date.now()) {
        setFormError('Scheduled appointment must be in the future.');
        return;
      }
      scheduledAt = combined.toISOString();
    }

    createMutation.mutate({
      propertyId: createPropertyId,
      spaceId: createSpaceId || null,
      categoryId: createCategoryId || null,
      title: createTitle.trim(),
      description: createDescription.trim(),
      priority: createPriority,
      estimatedCost: createEstimatedCost ? String(createEstimatedCost) : null,
      scheduledAt,
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Title & Actions */}
      <CollapsingTitle
        title="Maintenance Work Orders"
        subtitle="Track repair requests, dispatch certified providers, and manage work order timelines."
        actions={
          <div className="flex items-center gap-3">
            {properties.length > 0 && (
              <select
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
                aria-label="Filter by property"
                className="appearance-none rounded-xl border border-border bg-card px-4 py-2 text-xs sm:text-sm font-medium text-ink focus:outline-none focus:border-primary shadow-warm-xs min-h-[44px] cursor-pointer"
              >
                <option value="">All Properties</option>
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
                setIsCreateModalOpen(true);
              }}
              className="gap-2 shrink-0 min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>New Work Order</span>
            </Button>
          </div>
        }
      />

      {/* Filter Tabs & Priority Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {STATUS_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-colors border-b-2 whitespace-nowrap min-h-[44px]',
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

        <div className="flex items-center gap-2 shrink-0">
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            aria-label="Filter by priority"
            className="appearance-none rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-ink focus:outline-none focus:border-primary shadow-warm-xs min-h-[38px] cursor-pointer"
          >
            <option value="">All Priorities</option>
            {PRIORITIES.map((pr) => (
              <option key={pr} value={pr}>
                {pr} Priority
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Requests List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-28 rounded-2xl bg-sand/40 animate-pulse border border-border/50" />
          ))}
        </div>
      ) : isError ? (
        <div className="p-8 rounded-2xl bg-danger/10 border border-danger/30 text-center space-y-3">
          <p className="font-semibold text-danger">
            {error?.message || 'Unable to load maintenance requests.'}
          </p>
          <Button variant="secondary" size="sm" onClick={() => refetch()} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            <span>Try Again</span>
          </Button>
        </div>
      ) : requests.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card space-y-3">
          <div className="w-12 h-12 rounded-xl bg-sand/60 text-body flex items-center justify-center mx-auto">
            <Wrench className="w-6 h-6" />
          </div>
          <h3 className="font-sans font-semibold text-ink text-base">No work orders found</h3>
          <p className="text-body text-xs sm:text-sm max-w-md mx-auto">
            {activeTab === 'ALL'
              ? 'No active or archived maintenance jobs found for your properties.'
              : `No maintenance requests matching status ${activeTab.toLowerCase()}.`}
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsCreateModalOpen(true)}
            className="mt-2 min-h-[44px]"
          >
            Create Work Order
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <Link
              key={req.id}
              to={`/owner/maintenance/${req.id}`}
              className="block p-5 rounded-2xl bg-card border border-border hover:border-primary/40 hover:shadow-warm-sm transition-all group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-sans font-semibold text-ink text-sm sm:text-base">
                      {req.title}
                    </span>
                    <Badge variant={getStatusBadgeVariant(req.status)}>
                      {req.status}
                    </Badge>
                    <Badge variant={getPriorityBadgeVariant(req.priority)}>
                      {req.priority}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-body flex-wrap">
                    <span className="flex items-center gap-1">
                      <Building className="w-3.5 h-3.5 text-body" />
                      {req.property?.title || 'Property'} {req.space ? `(${req.space.title})` : ''}
                    </span>

                    {req.category && (
                      <span className="flex items-center gap-1">
                        <Wrench className="w-3.5 h-3.5 text-body" />
                        {req.category.name}
                      </span>
                    )}

                    {req.assignedProvider && (
                      <span className="flex items-center gap-1 font-medium text-ink">
                        <User className="w-3.5 h-3.5 text-primary" />
                        {req.assignedProvider.businessName || 'Assigned Provider'}
                      </span>
                    )}

                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-body" />
                      Created {formatKolkata(req.createdAt, 'dd MMM yyyy')}
                    </span>
                  </div>

                  <p className="text-xs text-body line-clamp-1 max-w-xl">
                    {req.description}
                  </p>
                </div>

                <div className="flex items-center gap-4 shrink-0 self-end sm:self-center">
                  <div className="text-right">
                    <span className="text-[11px] text-body block">
                      {req.actualCost ? 'Actual Cost' : 'Est. Cost'}
                    </span>
                    <span className="text-sm font-semibold text-ink">
                      {formatINR(req.actualCost || req.estimatedCost || '0.00')}
                    </span>
                  </div>

                  <span className="text-xs font-medium text-primary flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    <span>Manage</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Maintenance Request Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40">
          <div className="relative w-full max-w-lg rounded-2xl bg-card border border-border p-6 shadow-warm-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-editorial text-xl font-bold text-ink">New Work Order</h3>
                <p className="text-xs text-body">Submit a repair or maintenance task for your property.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="w-8 h-8 rounded-xl border border-border flex items-center justify-center text-body hover:text-ink"
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

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-ink">Property</label>
                  <select
                    value={createPropertyId}
                    onChange={(e) => {
                      setCreatePropertyId(e.target.value);
                      setCreateSpaceId('');
                    }}
                    className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:border-primary min-h-[44px]"
                    required
                  >
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-ink">Space (Optional)</label>
                  <select
                    value={createSpaceId}
                    onChange={(e) => setCreateSpaceId(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:border-primary min-h-[44px]"
                  >
                    <option value="">Entire Property</option>
                    {propertySpaces.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-ink">Service Category</label>
                  <select
                    value={createCategoryId}
                    onChange={(e) => setCreateCategoryId(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:border-primary min-h-[44px]"
                  >
                    <option value="">General Repair</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-ink">Priority Level</label>
                  <select
                    value={createPriority}
                    onChange={(e) => setCreatePriority(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:border-primary min-h-[44px]"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p} Priority
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-ink">Job Title</label>
                <input
                  type="text"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="e.g. Master bathroom pipe leakage repair"
                  minLength={3}
                  maxLength={200}
                  className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:border-primary min-h-[44px]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-ink">Problem Description</label>
                <textarea
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="Detail the issue, location on premises, and any specific access requirements..."
                  rows={3}
                  minLength={5}
                  maxLength={4000}
                  className="w-full rounded-xl border border-border bg-card p-3 text-xs sm:text-sm text-ink focus:outline-none focus:border-primary resize-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-ink">Estimated Budget (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10000000"
                    value={createEstimatedCost}
                    onChange={(e) => setCreateEstimatedCost(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:border-primary min-h-[44px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-ink">Target Date (Optional)</label>
                  <input
                    type="date"
                    value={createScheduledDate}
                    onChange={(e) => setCreateScheduledDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:border-primary min-h-[44px]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={createMutation.isPending}
                >
                  Create Work Order
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
