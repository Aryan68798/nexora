import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Plus,
  Search,
  ExternalLink,
  Edit3,
  Power,
  Copy,
  ChevronDown,
  Layers,
  MapPin,
  Clock,
  RotateCcw,
  ImageOff,
} from 'lucide-react';
import { api } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Badge } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import { useToast } from '../../components/ui/Toast';
import { ContextMenu } from '../../components/native/ContextMenu';
import { CollapsingTitle } from '../../components/native/CollapsingTitle';
import { ConfirmSheet } from '../../components/owner/ConfirmSheet';

export function OwnerPropertiesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Confirm sheet state for status toggle
  const [statusSheetProperty, setStatusSheetProperty] = useState(null);

  // Fetch properties owned by the authenticated caller
  const {
    data: propertiesData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['ownerProperties', { page, status: statusFilter || undefined, search: searchQuery || undefined }],
    queryFn: () =>
      api.get('/api/properties/mine', {
        params: {
          page,
          pageSize: 10,
          status: statusFilter || undefined,
          search: searchQuery || undefined,
        },
      }),
    staleTime: 30 * 1000,
  });

  const properties = propertiesData?.data || (Array.isArray(propertiesData) ? propertiesData : []);
  const meta = propertiesData?.meta || { page, pageSize: 10, total: properties.length, totalPages: 1 };

  // Status toggle mutation (ACTIVE <-> INACTIVE)
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }) => {
      return api.patch(`/api/properties/${id}`, { status: newStatus });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ownerProperties'] });
      queryClient.invalidateQueries({ queryKey: ['ownerProperty', variables.id] });
      toast.success(
        variables.newStatus === 'ACTIVE'
          ? 'Property activated and visible to customers'
          : 'Property set to inactive'
      );
      setStatusSheetProperty(null);
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to update property status');
    },
  });

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearchQuery(searchInput.trim());
    setPage(1);
  };

  const handleCopyLink = (propertyId) => {
    const url = `${window.location.origin}/properties/${propertyId}`;
    navigator.clipboard.writeText(url);
    toast.success('Public link copied to clipboard');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header with CollapsingTitle for native mobile feel */}
      <CollapsingTitle
        title="My Properties"
        subtitle="Manage your listed buildings, spaces, and visibility."
        actions={
          <div className="flex items-center gap-3">
            <Link to="/owner/properties/new">
              <Button
                variant="primary"
                leftIcon={<Plus className="w-4 h-4" />}
                className="min-h-[44px]"
              >
                List a Property
              </Button>
            </Link>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <div className="bg-card rounded-2xl border border-border p-3 sm:p-4 shadow-warm-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 text-body absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by title or city..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-sand/50 border border-border text-xs sm:text-sm font-medium text-ink placeholder:text-body/60 focus:outline-none focus:border-primary min-h-[44px]"
          />
        </form>

        {/* Status Dropdown */}
        <div className="relative shrink-0">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="appearance-none rounded-xl border border-border bg-sand/50 pl-3.5 pr-8 py-2 text-xs sm:text-sm font-medium text-ink focus:outline-none focus:border-primary cursor-pointer min-h-[44px]"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
            <option value="UNDER_MAINTENANCE">Under Maintenance</option>
          </select>
          <ChevronDown className="w-4 h-4 text-body absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="bg-card rounded-2xl border border-border divide-y divide-border overflow-hidden">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 sm:p-5">
              <div className="w-24 h-20 rounded-xl bg-sand skeleton-shimmer shrink-0" />
              <div className="flex-1 space-y-2 w-full">
                <div className="h-4 w-48 bg-sand rounded skeleton-shimmer" />
                <div className="h-3 w-32 bg-sand rounded skeleton-shimmer" />
                <div className="h-3 w-24 bg-sand rounded skeleton-shimmer" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="p-8 sm:p-12 rounded-2xl bg-danger/10 border border-danger/30 text-center space-y-3">
          <p className="font-semibold text-danger">
            {error?.message || 'Unable to load properties. Please try again.'}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => refetch()}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && properties.length === 0 && (
        <div className="p-12 sm:p-16 rounded-2xl bg-sand/40 border border-border text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-card border border-border flex items-center justify-center mx-auto text-primary shadow-warm-xs">
            <Building2 className="w-7 h-7 stroke-[1.5]" />
          </div>
          <div className="space-y-1">
            <h3 className="font-serif text-xl sm:text-2xl font-bold text-ink">
              {searchQuery || statusFilter ? 'No matching properties' : 'List your first property'}
            </h3>
            <p className="text-body text-sm max-w-md mx-auto leading-relaxed">
              {searchQuery || statusFilter
                ? 'Try adjusting your search terms or clearing the status filter.'
                : 'Add a building, haveli, office, or estate to create rentable spaces and accept booking requests.'}
            </p>
          </div>
          {searchQuery || statusFilter ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchInput('');
                setSearchQuery('');
                setStatusFilter('');
              }}
            >
              Clear Filters
            </Button>
          ) : (
            <Link to="/owner/properties/new">
              <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
                List Your First Property
              </Button>
            </Link>
          )}
        </div>
      )}

      {/* Properties List (Uniform rows, no bento) */}
      {!isLoading && !isError && properties.length > 0 && (
        <div className="bg-card rounded-2xl border border-border divide-y divide-border overflow-hidden shadow-warm-xs">
          {properties.map((property) => {
            const contextActions = [
              {
                label: 'View details',
                icon: ExternalLink,
                onClick: () => navigate(`/owner/properties/${property.id}`),
              },
              {
                label: 'Edit property',
                icon: Edit3,
                onClick: () => navigate(`/owner/properties/${property.id}/edit`),
              },
              {
                label: 'Add space',
                icon: Plus,
                onClick: () => navigate(`/owner/properties/${property.id}/spaces/new`),
              },
              {
                label: property.status === 'ACTIVE' ? 'Set inactive' : 'Set active',
                icon: Power,
                onClick: () => setStatusSheetProperty(property),
              },
              {
                label: 'Copy public link',
                icon: Copy,
                onClick: () => handleCopyLink(property.id),
              },
            ];

            return (
              <ContextMenu
                key={property.id}
                items={contextActions}
                buttonLabel={`Options for ${property.title}`}
              >
                <div className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-sand/30 transition-colors">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    {/* Cover or 'No photo yet' surface */}
                    <div
                      className="w-20 sm:w-24 h-16 sm:h-18 rounded-xl overflow-hidden bg-sand border border-border shrink-0 flex items-center justify-center text-center"
                      style={{ aspectRatio: '4/3' }}
                    >
                      {property.coverImageUrl ? (
                        <img
                          src={property.coverImageUrl}
                          alt={property.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-1.5 text-center bg-sand text-body">
                          <ImageOff className="w-4 h-4 text-body/50 mb-0.5" />
                          <span className="text-[10px] font-medium leading-tight text-body">No photo yet</span>
                        </div>
                      )}
                    </div>

                    {/* Details: title, city, type, status badge, space count */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          to={`/owner/properties/${property.id}`}
                          className="font-serif text-base sm:text-lg font-semibold text-ink hover:text-primary transition-colors truncate focus-ring rounded"
                        >
                          {property.title}
                        </Link>
                        <StatusBadge status={property.status} size="sm" />
                        {property.propertyType && (
                          <Badge variant="outline" size="xs">
                            {property.propertyType}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-3 sm:gap-4 text-xs text-body flex-wrap">
                        {(property.city || property.state) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span>{[property.city, property.state].filter(Boolean).join(', ')}</span>
                          </span>
                        )}

                        <span className="flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-body shrink-0" />
                          <span>{property.spaceCount ?? 0} {property.spaceCount === 1 ? 'space' : 'spaces'}</span>
                        </span>

                        {property.pendingBookingsCount != null && property.pendingBookingsCount > 0 && (
                          <span className="flex items-center gap-1 text-warning font-semibold">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span>{property.pendingBookingsCount} pending</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Context menu and quick actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Link to={`/owner/properties/${property.id}/spaces/new`} className="hidden sm:inline-flex">
                      <Button variant="ghost" size="sm" leftIcon={<Plus className="w-3.5 h-3.5" />}>
                        Add Space
                      </Button>
                    </Link>
                    <Link to={`/owner/properties/${property.id}`}>
                      <Button variant="outline" size="sm">
                        Manage
                      </Button>
                    </Link>
                  </div>
                </div>
              </ContextMenu>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && !isError && meta.totalPages > 1 && (
        <div className="pt-4 flex justify-center">
          <Pagination
            currentPage={meta.page}
            totalPages={meta.totalPages}
            onPageChange={(nextPage) => {
              setPage(nextPage);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        </div>
      )}

      {/* Confirm status change sheet */}
      {statusSheetProperty && (
        <ConfirmSheet
          isOpen={Boolean(statusSheetProperty)}
          onClose={() => setStatusSheetProperty(null)}
          onConfirm={() => {
            const newStatus = statusSheetProperty.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
            toggleStatusMutation.mutate({ id: statusSheetProperty.id, newStatus });
          }}
          title={statusSheetProperty.status === 'ACTIVE' ? 'Set Property Inactive?' : 'Activate Property?'}
          description={
            statusSheetProperty.status === 'ACTIVE'
              ? `Setting "${statusSheetProperty.title}" to inactive will hide all of its spaces from public search results and marketplace browsing.`
              : `Activating "${statusSheetProperty.title}" will allow its available spaces to be discovered and booked by customers.`
          }
          confirmLabel={statusSheetProperty.status === 'ACTIVE' ? 'Set Inactive' : 'Activate Property'}
          variant={statusSheetProperty.status === 'ACTIVE' ? 'warning' : 'primary'}
          isLoading={toggleStatusMutation.isPending}
        />
      )}
    </div>
  );
}
