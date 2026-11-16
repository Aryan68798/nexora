import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Building,
  Wrench,
  Calendar,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { api } from '../../api/client';
import { formatINR } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { CollapsingTitle } from '../../components/native/CollapsingTitle';

export function OwnerDashboardPage() {
  const [selectedPropertyId, setSelectedPropertyId] = useState('');

  // Fetch properties for the dropdown filter
  const { data: propertiesData } = useQuery({
    queryKey: ['owner-properties-list-minimal'],
    queryFn: async () => {
      const res = await api.get('/api/properties/mine');
      return res.data || res || [];
    },
  });

  const properties = propertiesData || [];

  // Fetch dashboard metrics
  const {
    data: dashboardData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['owner-dashboard-metrics', selectedPropertyId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedPropertyId) params.set('propertyId', selectedPropertyId);
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await api.get(`/api/owner/dashboard${queryString}`);
      return res.data || res;
    },
  });

  const totals = dashboardData?.totals || {};
  const series = dashboardData?.series || [];
  const health = dashboardData?.health || {};
  const maintenance = dashboardData?.maintenance || {};
  const upcoming = dashboardData?.upcoming || {};
  const occupancy = dashboardData?.occupancy;

  const incomeReceived = totals.incomeReceived || '0.00';
  const incomeExpected = totals.incomeExpected || '0.00';
  const expenses = totals.expenses || '0.00';
  const net = totals.net || '0.00';

  return (
    <div className="space-y-6 pb-12">
      {/* Page Title with Property Filter */}
      <CollapsingTitle
        title="Portfolio Dashboard"
        subtitle="Live totals across revenue, bookings, property health, and work orders."
        actions={
          <div className="flex items-center gap-3">
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
          </div>
        }
      />

      {/* Error state */}
      {isError && (
        <div className="p-8 rounded-2xl bg-danger/10 border border-danger/30 text-center space-y-3">
          <p className="font-semibold text-danger">
            {error?.message || 'Unable to load dashboard data. Please try again.'}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Try Again</span>
          </Button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-28 rounded-2xl bg-sand/40 animate-pulse border border-border/50" />
            ))}
          </div>
          <div className="h-64 rounded-2xl bg-sand/40 animate-pulse border border-border/50" />
        </div>
      ) : !isError && (
        <div className="space-y-6">
          {/* Top 4 KPI Metrics - Cohesive Grouped Grid */}
          <div className="rounded-2xl bg-card border border-border shadow-warm-xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border overflow-hidden">
            {/* Income Received */}
            <div className="p-6 space-y-1">
              <span className="text-xs font-medium text-body uppercase tracking-wider block">
                Income Received
              </span>
              <div className="text-2xl sm:text-3xl font-bold font-sans text-ink">
                {formatINR(incomeReceived)}
              </div>
            </div>

            {/* Expected Income */}
            <div className="p-6 space-y-1">
              <span className="text-xs font-medium text-body uppercase tracking-wider block">
                Expected Income
              </span>
              <div className="text-2xl sm:text-3xl font-bold font-sans text-ink">
                {formatINR(incomeExpected)}
              </div>
            </div>

            {/* Total Expenses */}
            <div className="p-6 space-y-1">
              <span className="text-xs font-medium text-body uppercase tracking-wider block">
                Total Expenses
              </span>
              <div className="text-2xl sm:text-3xl font-bold font-sans text-ink">
                {formatINR(expenses)}
              </div>
            </div>

            {/* Net Operating Payout */}
            <div className="p-6 space-y-1">
              <span className="text-xs font-medium text-body uppercase tracking-wider block">
                Net Operating Payout
              </span>
              <div
                className={`text-2xl sm:text-3xl font-bold font-sans ${Number(net) < 0 ? 'text-danger' : 'text-primary'
                  }`}
              >
                {formatINR(net)}
              </div>
            </div>
          </div>

          {/* Occupancy and Urgent Action Items Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {occupancy && (
              <div className="p-5 rounded-2xl bg-card border border-border shadow-warm-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-body uppercase tracking-wider block">
                    Average Occupancy
                  </span>
                  <div className="text-2xl font-bold font-sans text-ink mt-0.5">
                    {occupancy.averageRate || 0}%
                  </div>
                  <span className="text-xs text-body">
                    Across {occupancy.activeListingCount || 0} active listings ({occupancy.totalUnits || 0} units)
                  </span>
                </div>
                <div className="w-12 h-12 rounded-xl bg-sand/60 text-primary flex items-center justify-center font-bold font-sans text-sm">
                  {occupancy.averageRate || 0}%
                </div>
              </div>
            )}

            <div className="p-5 rounded-2xl bg-card border border-border shadow-warm-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-body uppercase tracking-wider block">
                  Urgent Action Items
                </span>
                <div className="text-2xl font-bold font-sans text-ink mt-0.5">
                  {(maintenance?.urgentHighOpenCount || 0) + (health?.overdueCount || 0)}
                </div>
                <span className="text-xs text-body">
                  {maintenance?.urgentHighOpenCount || 0} urgent maintenance · {health?.overdueCount || 0} overdue inspections
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-sand/60 text-body flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-warning" />
              </div>
            </div>
          </div>

          {/* Monthly Performance Table */}
          {series.length > 0 && (
            <div className="p-6 rounded-2xl bg-card border border-border shadow-warm-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-bold text-ink tracking-tight">
                  Monthly Performance Ledger
                </h3>
              </div>

              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-border text-body font-medium">
                      <th className="py-2.5 pr-4">Month</th>
                      <th className="py-2.5 px-4 text-right">Income Received</th>
                      <th className="py-2.5 px-4 text-right">Expenses</th>
                      <th className="py-2.5 pl-4 text-right">Net Operating Payout</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {series.map((row) => (
                      <tr key={row.month} className="hover:bg-sand/20 transition-colors">
                        <td className="py-3 pr-4 font-semibold text-ink">{row.month}</td>
                        <td className="py-3 px-4 text-right font-medium text-ink">
                          {formatINR(row.incomeReceived)}
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-body">
                          {formatINR(row.expenses)}
                        </td>
                        <td
                          className={`py-3 pl-4 text-right font-semibold ${Number(row.net) < 0 ? 'text-danger' : 'text-primary'
                            }`}
                        >
                          {formatINR(row.net)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Property Health & Condition Breakdown */}
          {health && (
            <div className="p-6 rounded-2xl bg-card border border-border shadow-warm-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-ink tracking-tight">
                    Portfolio Asset Health
                  </h3>
                  <p className="text-xs text-body">
                    Average score across physical inspection reviews.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        health.grade === 'A' || health.grade === 'B'
                          ? 'bg-success'
                          : health.grade === 'C'
                            ? 'bg-warning'
                            : 'bg-danger'
                      }`}
                    />
                    Grade {health.grade || 'N/A'} ({health.averageScore || 0}/100)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Upcoming Activity Schedule */}
          {upcoming && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Next Bookings */}
              <div className="p-5 rounded-2xl bg-card border border-border shadow-warm-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    <h4 className="font-semibold text-ink text-sm">Upcoming Bookings</h4>
                  </div>
                  <Link
                    to="/owner/bookings"
                    className="text-xs font-medium text-primary hover:text-primary-hover flex items-center gap-1"
                  >
                    <span>View all</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                {upcoming.bookings?.length > 0 ? (
                  <div className="space-y-2">
                    {upcoming.bookings.slice(0, 3).map((b) => (
                      <div
                        key={b.id}
                        className="p-3 rounded-xl bg-sand/30 border border-border text-xs space-y-1"
                      >
                        <div className="font-medium text-ink truncate">
                          {b.space?.name || 'Space Booking'}
                        </div>
                        <div className="text-body flex justify-between">
                          <span>{b.customer?.name || 'Guest'}</span>
                          <span className="font-semibold text-ink">{formatINR(b.totalAmount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-body py-4 text-center">No upcoming bookings</p>
                )}
              </div>

              {/* Next Inspections */}
              <div className="p-5 rounded-2xl bg-card border border-border shadow-warm-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-primary" />
                    <h4 className="font-semibold text-ink text-sm">Next Inspections</h4>
                  </div>
                  <Link
                    to="/owner/inspections"
                    className="text-xs font-medium text-primary hover:text-primary-hover flex items-center gap-1"
                  >
                    <span>View all</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                {upcoming.inspections?.length > 0 ? (
                  <div className="space-y-2">
                    {upcoming.inspections.slice(0, 3).map((insp) => (
                      <div
                        key={insp.id}
                        className="p-3 rounded-xl bg-sand/30 border border-border text-xs space-y-1"
                      >
                        <div className="font-medium text-ink truncate">
                          {insp.property?.title || 'Property Inspection'}
                        </div>
                        <div className="text-body flex justify-between">
                          <span>{insp.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-body py-4 text-center">No scheduled inspections</p>
                )}
              </div>

              {/* Next Maintenance Jobs */}
              <div className="p-5 rounded-2xl bg-card border border-border shadow-warm-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-primary" />
                    <h4 className="font-semibold text-ink text-sm">Active Maintenance</h4>
                  </div>
                  <Link
                    to="/owner/maintenance"
                    className="text-xs font-medium text-primary hover:text-primary-hover flex items-center gap-1"
                  >
                    <span>View all</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                {upcoming.maintenance?.length > 0 ? (
                  <div className="space-y-2">
                    {upcoming.maintenance.slice(0, 3).map((m) => (
                      <div
                        key={m.id}
                        className="p-3 rounded-xl bg-sand/30 border border-border text-xs space-y-1"
                      >
                        <div className="font-medium text-ink truncate">{m.title}</div>
                        <div className="text-body flex justify-between">
                          <span>{m.priority} Priority</span>
                          <span className="font-semibold text-ink">
                            {formatINR(m.estimatedCost || '0.00')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-body py-4 text-center">No open work orders</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
