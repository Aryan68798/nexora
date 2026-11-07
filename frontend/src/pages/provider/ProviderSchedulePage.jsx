import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  Clock,
  Building,
  MapPin,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { api } from '../../api/client';
import { formatKolkata } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { CollapsingTitle } from '../../components/native/CollapsingTitle';

export function ProviderSchedulePage() {
  const {
    data: jobsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['provider-schedule-jobs'],
    queryFn: async () => {
      const res = await api.get('/api/maintenance-requests?status=ASSIGNED,IN_PROGRESS&limit=100');
      const items = res.data || [];
      // Sort jobs by scheduledAt (if available) or createdAt
      return items.sort((a, b) => {
        const timeA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : new Date(a.createdAt).getTime();
        const timeB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : new Date(b.createdAt).getTime();
        return timeA - timeB;
      });
    },
  });

  const jobs = jobsData || [];

  return (
    <div className="space-y-6 pb-12">
      {/* Title */}
      <CollapsingTitle
        title="Dispatch Schedule"
        subtitle="Chronological agenda of upcoming on-site maintenance visits and property repairs."
      />

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-24 rounded-2xl bg-sand/40 animate-pulse border border-border/50" />
          ))}
        </div>
      ) : isError ? (
        <div className="p-8 rounded-2xl bg-danger/10 border border-danger/30 text-center space-y-3">
          <p className="font-semibold text-danger">
            {error?.message || 'Unable to load schedule.'}
          </p>
          <Button variant="secondary" size="sm" onClick={() => refetch()} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            <span>Try Again</span>
          </Button>
        </div>
      ) : jobs.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card space-y-3">
          <div className="w-12 h-12 rounded-xl bg-sand/60 text-body flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="font-sans font-semibold text-ink text-base">No upcoming visits</h3>
          <p className="text-body text-xs sm:text-sm max-w-md mx-auto">
            You currently have no scheduled appointments or active on-site service orders.
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
                    <StatusBadge status={job.status} />
                    {job.priority === 'URGENT' && (
                      <span className="text-xs font-semibold text-danger">
                        Urgent
                      </span>
                    )}
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

                    <span className="flex items-center gap-1 text-primary font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      {job.scheduledAt
                        ? formatKolkata(job.scheduledAt, 'dd MMM yyyy, hh:mm a')
                        : 'Unscheduled visit'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <span className="text-xs font-medium text-primary flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    <span>View Dispatch</span>
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

