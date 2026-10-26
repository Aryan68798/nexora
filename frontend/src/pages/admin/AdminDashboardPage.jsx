import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { formatINR } from '../../lib/utils';
import { Card } from '../../components/ui/Card';
import {
  TrendingUp,
  DollarSign,
  Building,
  Wrench,
  ShieldCheck,
  Users,
  CalendarCheck,
  ArrowRight,
} from 'lucide-react';

export function AdminDashboardPage() {
  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ['adminDashboard'],
    queryFn: async () => {
      const res = await api.get('/api/admin/dashboard');
      return res?.data || res || {};
    },
  });

  const grossVolume = dashboardData?.grossVolume || '0.00';
  const platformFees = dashboardData?.platformFeesEarned || '0.00';
  const activeProperties = dashboardData?.activeProperties ?? 0;
  const openMaintenance = dashboardData?.openMaintenance ?? 0;
  const pendingVerifications = dashboardData?.pendingProviderVerifications ?? 0;

  const usersByRole = dashboardData?.usersByRole || {};
  const bookingsByStatus = dashboardData?.bookingsByStatus || {};

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="font-editorial text-3xl font-bold text-ink">
            Platform Administration
          </h1>
          <p className="text-body text-sm mt-1">
            System telemetry, financial health, and operational performance metrics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/admin/verifications"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-sand hover:bg-sand/80 text-ink rounded-xl border border-border transition-colors"
          >
            <ShieldCheck className="w-4 h-4 text-primary" />
            Verifications
            {pendingVerifications > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-md bg-amber/20 text-ink text-xs font-semibold">
                {pendingVerifications}
              </span>
            )}
          </Link>
          <Link
            to="/admin/users"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white hover:bg-primary-hover rounded-xl transition-colors"
          >
            <Users className="w-4 h-4" />
            Manage Users
          </Link>
        </div>
      </div>

      {isLoading ? (
        <Card className="p-12 text-center text-body">Loading platform telemetry...</Card>
      ) : error ? (
        <Card className="p-8 text-center text-danger border-danger/30">
          Failed to load dashboard metrics.
        </Card>
      ) : (
        <>
          {/* Financial & Operational KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 bg-card border border-border rounded-xl space-y-2">
              <div className="flex items-center justify-between text-body text-xs font-semibold uppercase tracking-wider">
                <span>Gross Volume</span>
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <div className="text-2xl font-bold text-ink">
                {formatINR(grossVolume)}
              </div>
              <p className="text-xs text-body">Total transactions recorded</p>
            </Card>

            <Card className="p-5 bg-card border border-border rounded-xl space-y-2">
              <div className="flex items-center justify-between text-body text-xs font-semibold uppercase tracking-wider">
                <span>Platform Earnings</span>
                <DollarSign className="w-4 h-4 text-success" />
              </div>
              <div className="text-2xl font-bold text-ink">
                {formatINR(platformFees)}
              </div>
              <p className="text-xs text-body">Net platform service fees</p>
            </Card>

            <Card className="p-5 bg-card border border-border rounded-xl space-y-2">
              <div className="flex items-center justify-between text-body text-xs font-semibold uppercase tracking-wider">
                <span>Active Properties</span>
                <Building className="w-4 h-4 text-ink" />
              </div>
              <div className="text-2xl font-bold text-ink">
                {activeProperties}
              </div>
              <p className="text-xs text-body">Live verified estates</p>
            </Card>

            <Card className="p-5 bg-card border border-border rounded-xl space-y-2">
              <div className="flex items-center justify-between text-body text-xs font-semibold uppercase tracking-wider">
                <span>Open Maintenance</span>
                <Wrench className="w-4 h-4 text-warning" />
              </div>
              <div className="text-2xl font-bold text-ink">
                {openMaintenance}
              </div>
              <p className="text-xs text-body">Active repair requests</p>
            </Card>
          </div>

          {/* Breakdown Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Users Breakdown */}
            <Card className="p-6 bg-card border border-border rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-ink flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary" />
                  Users by Role
                </h2>
                <Link
                  to="/admin/users"
                  className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                >
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-3 bg-sand/30 border border-border rounded-xl text-center">
                  <div className="text-xs text-body font-medium">Customers</div>
                  <div className="text-xl font-bold text-ink mt-1">
                    {usersByRole.CUSTOMER || 0}
                  </div>
                </div>
                <div className="p-3 bg-sand/30 border border-border rounded-xl text-center">
                  <div className="text-xs text-body font-medium">Owners</div>
                  <div className="text-xl font-bold text-ink mt-1">
                    {usersByRole.OWNER || 0}
                  </div>
                </div>
                <div className="p-3 bg-sand/30 border border-border rounded-xl text-center">
                  <div className="text-xs text-body font-medium">Providers</div>
                  <div className="text-xl font-bold text-ink mt-1">
                    {usersByRole.PROVIDER || 0}
                  </div>
                </div>
                <div className="p-3 bg-sand/30 border border-border rounded-xl text-center">
                  <div className="text-xs text-body font-medium">Admins</div>
                  <div className="text-xl font-bold text-ink mt-1">
                    {usersByRole.ADMIN || 0}
                  </div>
                </div>
              </div>
            </Card>

            {/* Bookings Breakdown */}
            <Card className="p-6 bg-card border border-border rounded-xl space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-ink flex items-center gap-2">
                  <CalendarCheck className="w-5 h-5 text-primary" />
                  Bookings Pipeline
                </h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                <div className="p-3 bg-sand/30 border border-border rounded-xl text-center">
                  <div className="text-xs text-body font-medium">Pending</div>
                  <div className="text-xl font-bold text-ink mt-1">
                    {bookingsByStatus.PENDING || 0}
                  </div>
                </div>
                <div className="p-3 bg-sand/30 border border-border rounded-xl text-center">
                  <div className="text-xs text-body font-medium">Confirmed</div>
                  <div className="text-xl font-bold text-ink mt-1">
                    {bookingsByStatus.CONFIRMED || 0}
                  </div>
                </div>
                <div className="p-3 bg-sand/30 border border-border rounded-xl text-center">
                  <div className="text-xs text-body font-medium">Completed</div>
                  <div className="text-xl font-bold text-ink mt-1">
                    {bookingsByStatus.COMPLETED || 0}
                  </div>
                </div>
                <div className="p-3 bg-sand/30 border border-border rounded-xl text-center">
                  <div className="text-xs text-body font-medium">Cancelled</div>
                  <div className="text-xl font-bold text-ink mt-1">
                    {bookingsByStatus.CANCELLED || 0}
                  </div>
                </div>
                <div className="p-3 bg-sand/30 border border-border rounded-xl text-center">
                  <div className="text-xs text-body font-medium">Rejected</div>
                  <div className="text-xl font-bold text-ink mt-1">
                    {bookingsByStatus.REJECTED || 0}
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Quick Management Navigation */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <Link
              to="/admin/verifications"
              className="p-5 bg-card hover:bg-sand/20 border border-border rounded-xl flex items-center justify-between transition-colors group"
            >
              <div>
                <div className="font-semibold text-ink">Provider Verification</div>
                <div className="text-xs text-body mt-0.5">
                  Review trade documents and approve provider applications
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-body group-hover:text-primary transition-colors" />
            </Link>

            <Link
              to="/admin/properties"
              className="p-5 bg-card hover:bg-sand/20 border border-border rounded-xl flex items-center justify-between transition-colors group"
            >
              <div>
                <div className="font-semibold text-ink">Property Approvals</div>
                <div className="text-xs text-body mt-0.5">
                  Inspect estate listings, activate, or update maintenance status
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-body group-hover:text-primary transition-colors" />
            </Link>

            <Link
              to="/admin/users"
              className="p-5 bg-card hover:bg-sand/20 border border-border rounded-xl flex items-center justify-between transition-colors group"
            >
              <div>
                <div className="font-semibold text-ink">User Directory</div>
                <div className="text-xs text-body mt-0.5">
                  Manage roles, toggle account active states, and audit users
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-body group-hover:text-primary transition-colors" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export default AdminDashboardPage;

