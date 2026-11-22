import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { formatKolkata } from '../../lib/utils';
import { useToast } from '../../components/ui/Toast';
import { Input } from '../../components/ui/Input';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Card } from '../../components/ui/Card';
import {
  Search,
  MapPin,
  User,
} from 'lucide-react';

export function AdminPropertiesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const { data: propertiesData, isLoading, error } = useQuery({
    queryKey: ['adminProperties'],
    queryFn: async () => {
      const res = await api.get('/api/properties?pageSize=100');
      return res?.data || res || [];
    },
  });

  const properties = Array.isArray(propertiesData) ? propertiesData : [];

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      return api.patch(`/api/properties/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminProperties'] });
      toast.success('Property status updated successfully.');
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to update property status');
    },
  });

  const filteredProperties = properties.filter((p) => {
    const matchesSearch =
      !searchTerm ||
      p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.owner?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'ALL' || p.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = (propertyId, newStatus) => {
    statusMutation.mutate({ id: propertyId, status: newStatus });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="font-editorial text-3xl font-bold text-ink">
            Property Approvals &amp; Compliance
          </h1>
          <p className="text-body text-sm mt-1">
            Oversee listed real estate properties, verify regulatory compliance, and control listing activation states.
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-body absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by title, city, or owner..."
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-sand/50 border border-border rounded-xl self-start sm:self-auto">
          {['ALL', 'ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${statusFilter === st
                ? 'bg-card text-ink shadow-sm'
                : 'text-body hover:text-ink'
                }`}
            >
              {st === 'UNDER_MAINTENANCE' ? 'Maintenance' : st}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Card className="p-12 text-center text-body">Loading listed properties...</Card>
      ) : error ? (
        <Card className="p-8 text-center text-danger border-danger/30">
          Failed to load properties.
        </Card>
      ) : filteredProperties.length === 0 ? (
        <Card className="p-12 text-center text-body">
          No properties found matching the filter criteria.
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredProperties.map((p) => (
            <Card
              key={p.id}
              className="p-5 bg-card border border-border rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-shadow hover:shadow-sm"
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-base font-bold text-ink truncate">
                    {p.title}
                  </h2>

                  <StatusBadge status={p.status} />
                  <span className="text-xs font-medium text-body">
                    · {p.propertyType || 'COMMERCIAL'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-body">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-body" />
                    {p.city}, {p.state}
                  </span>
                  {p.owner && (
                    <span className="flex items-center gap-1.5 text-ink font-medium">
                      <User className="w-3.5 h-3.5 text-body" />
                      Owner: {p.owner.name}
                    </span>
                  )}
                  {p.createdAt && (
                    <span className="text-body/80">
                      Listed: {formatKolkata(p.createdAt)}
                    </span>
                  )}
                </div>
              </div>

              {/* Status Selector */}
              <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-border/60">
                <span className="text-xs text-body font-medium">Status:</span>
                <select
                  value={p.status}
                  onChange={(e) => handleStatusChange(p.id, e.target.value)}
                  disabled={statusMutation.isPending}
                  className="px-2.5 py-1.5 text-xs text-ink bg-card border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="UNDER_MAINTENANCE">UNDER_MAINTENANCE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default AdminPropertiesPage;
