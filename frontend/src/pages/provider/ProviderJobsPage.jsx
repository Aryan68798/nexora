import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Wrench,
  Calendar,
  Building,
  ArrowRight,
  RotateCcw,
  MapPin,
} from 'lucide-react';
import { api } from '../../api/client';
import { formatINR, formatKolkata, cn } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { CollapsingTitle } from '../../components/native/CollapsingTitle';

const JOB_TABS = [
  { id: 'ACTIVE', label: 'Active Jobs' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'ALL', label: 'All Dispatches' },
];

export function ProviderJobsPage() {
  const [activeTab, setActiveTab] = useState('ACTIVE');

  // Fetch provider assigned jobs
  const {
    data: jobsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['provider-jobs', activeTab],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (activeTab === 'ACTIVE') {
        params.set('status', 'ASSIGNED,IN_PROGRESS');
      } else if (activeTab === 'COMPLETED') {
        params.set('status', 'COMPLETED');
      }
      const res = await api.get(`/api/maintenance-requests?${params.toString()}`);
      return res.data || [];
    },
  });

  const jobs = jobsData || [];

  return (
    <div className="space-y-6 pb-12">
      {/* Title */}
      <CollapsingTitle
        title="Provider Job Board"
        subtitle="Manage assigned maintenance visits, track on-site execution, and complete work orders."
      />

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-1 overflow-x-auto no-scrollbar">
        {JOB_TABS.map((tab) => {
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

      {/* Jobs List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-28 rounded-2xl bg-sand/40 animate-pulse border border-border/50" />
          ))}
        </div>
      ) : isError ? (
        <div className="p-8 rounded-2xl bg-danger/10 border border-danger/30 text-center space-y-3">
          <p className="font-semibold text-danger">
            {error?.message || 'Unable to load assigned jobs.'}
          </p>
          <Button variant="secondary" size="sm" onClick={() => refetch()} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            <span>Try Again</span>
          </Button>
        </div>
      ) : jobs.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card space-y-3">
          <div className="w-12 h-12 rounded-xl bg-sand/60 text-body flex items-center justify-center mx-auto">
            <Wrench className="w-6 h-6" />
          </div>
          <h3 className="font-sans font-semibold text-ink text-base">No service jobs found</h3>
          <p className="text-body text-xs sm:text-sm max-w-md mx-auto">
            {activeTab === 'ACTIVE'
              ? 'You have no open or in-progress maintenance visits scheduled currently.'
              : 'No service job history matching this filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <Link
              key={job.id}
              to={`/provider/jobs/${job.id}`}
              className="block p-5 rounded-2xl bg-card border border-border hover:border-primary/40 hover:shadow-warm-sm transition-all group"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-sans font-semibold text-ink text-sm sm:text-base">
                      {job.title}
                    </span>
                    <Badge
                      variant={
                        job.status === 'COMPLETED'
                          ? 'success'
                          : job.status === 'IN_PROGRESS'
                            ? 'warning'
                            : job.status === 'ASSIGNED'
                              ? 'neutral'
                              : 'secondary'
                      }
                    >
                      {job.status}
                    </Badge>
                    <Badge variant={job.priority === 'URGENT' ? 'danger' : 'secondary'}>
                      {job.priority}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-body flex-wrap">
                    <span className="flex items-center gap-1 font-medium text-ink">
                      <Building className="w-3.5 h-3.5 text-primary" />
                      {job.property?.title} {job.space ? `(${job.space.title})` : ''}
                    </span>

                    {job.property?.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-body" />
                        {job.property.city}
                      </span>
                    )}

                    {job.scheduledAt && (
                      <span className="flex items-center gap-1 text-primary">
                        <Calendar className="w-3.5 h-3.5" />
                        Target: {formatKolkata(job.scheduledAt, 'dd MMM yyyy, hh:mm a')}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-body line-clamp-1 max-w-xl">
                    {job.description}
                  </p>
                </div>

                <div className="flex items-center gap-4 shrink-0 self-end sm:self-center">
                  <div className="text-right">
                    <span className="text-[11px] text-body block">
                      {job.actualCost ? 'Earned' : 'Est. Payout'}
                    </span>
                    <span className="text-sm font-semibold text-ink">
                      {formatINR(job.actualCost || job.estimatedCost || '0.00')}
                    </span>
                  </div>

                  <span className="text-xs font-medium text-primary flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    <span>View Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

