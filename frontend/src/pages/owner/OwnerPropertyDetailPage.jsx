import React, { useState } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MapPin,
  Edit3,
  Power,
  Trash2,
  Plus,
  ExternalLink,
  Layers,
  Clock,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { api } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Badge } from '../../components/ui/Badge';
import { Price } from '../../components/ui/Price';
import { PlaceholderImage } from '../../components/ui/PlaceholderImage';
import { useToast } from '../../components/ui/Toast';
import { ConfirmSheet } from '../../components/owner/ConfirmSheet';
import { ImageUploader } from '../../components/owner/ImageUploader';
import { normalizeMediaList } from '../../lib/mediaUtils';
import { formatKolkataDate, formatKolkataTime } from '../../lib/utils';

export function OwnerPropertyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [confirmStatusOpen, setConfirmStatusOpen] = useState(false);
  const [deletePropertyOpen, setDeletePropertyOpen] = useState(false);
  const [deleteSpaceId, setDeleteSpaceId] = useState(null);
  const [spaceToDelete, setSpaceToDelete] = useState(null);
  const [activeBookingError, setActiveBookingError] = useState(null);

  // Check if owner was just redirected with prompt to add space
  const promptAddSpace = location.state?.promptAddSpace;

  // Fetch full property details
  const {
    data: propertyData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['ownerProperty', id],
    queryFn: () => api.get(`/api/properties/${id}`),
    staleTime: 30 * 1000,
  });

  const property = propertyData?.data || propertyData;

  // Fetch pending booking requests for this property (next 5)
  const { data: pendingBookingsData } = useQuery({
    queryKey: ['ownerPropertyBookings', id],
    queryFn: () =>
      api.get('/api/owner/bookings', {
        params: { propertyId: id, status: 'PENDING', pageSize: 5 },
      }),
    staleTime: 30 * 1000,
  });

  const pendingBookings = pendingBookingsData?.data || [];

  // Toggle property active/inactive status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async (newStatus) => {
      return api.patch(`/api/properties/${id}`, { status: newStatus });
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['ownerProperty', id] });
      queryClient.invalidateQueries({ queryKey: ['ownerProperties'] });
      setConfirmStatusOpen(false);
      const isNowActive = (updated?.data?.status || updated?.status) === 'ACTIVE';
      toast.success(isNowActive ? 'Property activated' : 'Property set to inactive');
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to update property status');
    },
  });

  // Soft delete property mutation
  const deletePropertyMutation = useMutation({
    mutationFn: async () => {
      return api.delete(`/api/properties/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ownerProperties'] });
      toast.success('Listing removed successfully');
      navigate('/owner/properties');
    },
    onError: (err) => {
      if (err?.code === 'HAS_ACTIVE_BOOKINGS' || err?.data?.code === 'HAS_ACTIVE_BOOKINGS') {
        setActiveBookingError(
          'This property cannot be removed because it has active or future bookings. Please fulfill or cancel existing reservations first.'
        );
      } else {
        toast.error(err?.message || 'Failed to remove listing');
      }
    },
  });

  // Soft delete space mutation
  const deleteSpaceMutation = useMutation({
    mutationFn: async (spaceId) => {
      return api.delete(`/api/spaces/${spaceId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ownerProperty', id] });
      setDeleteSpaceId(null);
      setSpaceToDelete(null);
      toast.success('Space removed successfully');
    },
    onError: (err) => {
      if (err?.code === 'HAS_ACTIVE_BOOKINGS' || err?.data?.code === 'HAS_ACTIVE_BOOKINGS') {
        toast.error(
          'This space cannot be removed because it has active or future bookings.'
        );
      } else {
        toast.error(err?.message || 'Failed to delete space');
      }
    },
  });

  // Toggle space status (AVAILABLE <-> UNAVAILABLE)
  const toggleSpaceStatusMutation = useMutation({
    mutationFn: async ({ spaceId, newStatus }) => {
      return api.patch(`/api/spaces/${spaceId}`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ownerProperty', id] });
      toast.success('Space status updated');
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to update space status');
    },
  });

  // Media photo actions for this property:
  // 1. Upload new photo
  const handleUploadPhoto = async (stagedItem) => {
    try {
      const formData = new FormData();
      formData.append('file', stagedItem.file);
      if (stagedItem.caption) formData.append('caption', stagedItem.caption);

      const res = await api.post(`/api/properties/${id}/media`, formData);
      const uploaded = res?.data || res;
      queryClient.invalidateQueries({ queryKey: ['ownerProperty', id] });
      toast.success('Photo uploaded');
      return uploaded;
    } catch (err) {
      toast.error(err?.message || 'Failed to upload photo');
      throw err;
    }
  };

  // 2. Set cover photo
  const handleSetCoverPhoto = async (mediaId) => {
    try {
      await api.patch(`/api/property-media/${mediaId}`, { isCover: true });
      queryClient.invalidateQueries({ queryKey: ['ownerProperty', id] });
      toast.success('Cover photo updated');
    } catch (err) {
      toast.error(err?.message || 'Failed to set cover photo');
    }
  };

  // 3. Delete photo
  const handleDeletePhoto = async (mediaId) => {
    try {
      await api.delete(`/api/property-media/${mediaId}`);
      queryClient.invalidateQueries({ queryKey: ['ownerProperty', id] });
      toast.success('Photo removed');
    } catch (err) {
      toast.error(err?.message || 'Failed to remove photo');
    }
  };

  // 4. Reorder photo
  const handleReorderPhoto = async (mediaId, newOrder) => {
    try {
      await api.patch(`/api/property-media/${mediaId}`, { sortOrder: newOrder });
      queryClient.invalidateQueries({ queryKey: ['ownerProperty', id] });
    } catch (err) {
      toast.error(err?.message || 'Failed to update photo order');
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="h-8 w-64 bg-sand rounded skeleton-shimmer" />
        <div className="h-4 w-48 bg-sand rounded skeleton-shimmer" />
        <div className="h-64 rounded-2xl bg-sand skeleton-shimmer" />
      </div>
    );
  }

  if (isError || !property) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-danger/10 border border-danger/30 flex items-center justify-center mx-auto text-danger">
          <AlertCircle className="w-7 h-7 stroke-[1.5]" />
        </div>
        <h2 className="font-serif text-2xl font-bold text-ink">Property Not Found</h2>
        <p className="text-body text-sm max-w-md mx-auto">
          {error?.message || 'The property you are looking for does not exist or you do not have permission to manage it.'}
        </p>
        <div className="pt-2 flex justify-center gap-3">
          <Button variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
          <Button variant="primary" onClick={() => navigate('/owner/properties')}>
            Back to Properties
          </Button>
        </div>
      </div>
    );
  }

  const normalizedMedia = normalizeMediaList(property.media || []);
  const spacesList = property.spaces || [];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
      {/* Prompt Banner if owner just listed property */}
      {promptAddSpace && (
        <div className="p-4 sm:p-5 rounded-2xl bg-primary/10 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <h3 className="font-serif font-bold text-ink text-base">Property created successfully</h3>
            <p className="text-body text-xs sm:text-sm">
              Now add your first rentable room, office, studio, or hall to start taking booking requests.
            </p>
          </div>
          <Link to={`/owner/properties/${id}/spaces/new`} className="shrink-0">
            <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />}>
              Add Your First Space
            </Button>
          </Link>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-border">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-editorial text-3xl sm:text-4xl lg:text-5xl font-light text-ink tracking-tight">
              {property.title}
            </h1>
            <StatusBadge status={property.status} />
            {property.propertyType && (
              <Badge variant="outline" size="sm">
                {property.propertyType}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs sm:text-sm text-body">
            <MapPin className="w-4 h-4 text-primary shrink-0" />
            <span>
              {[property.addressLine1, property.addressLine2, property.city, property.state, property.postalCode, property.country]
                .filter(Boolean)
                .join(', ')}
            </span>
          </div>

          {property.description && (
            <p className="text-body text-sm leading-relaxed max-w-2xl pt-1">
              {property.description}
            </p>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {property.status === 'ACTIVE' && (
            <Link to={`/properties/${id}`} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost" size="sm" leftIcon={<ExternalLink className="w-3.5 h-3.5" />}>
                View Public Page
              </Button>
            </Link>
          )}
          <Link to={`/owner/properties/${id}/edit`}>
            <Button variant="outline" size="sm" leftIcon={<Edit3 className="w-3.5 h-3.5" />}>
              Edit Property
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmStatusOpen(true)}
            leftIcon={<Power className="w-3.5 h-3.5" />}
          >
            {property.status === 'ACTIVE' ? 'Set Inactive' : 'Activate'}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              setActiveBookingError(null);
              setDeletePropertyOpen(true);
            }}
            leftIcon={<Trash2 className="w-3.5 h-3.5" />}
          >
            Remove Listing
          </Button>
        </div>
      </div>

      {/* SECTION 1: PHOTOS GALLERY (Uniform row, no mixed bento) */}
      <section className="bg-card rounded-2xl border border-border p-6 shadow-warm-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-xl font-semibold text-ink">Property Photos</h2>
            <p className="text-xs text-body mt-0.5">
              Exterior facade, common hallways, lobby, and building grounds ({normalizedMedia.length} of 10 uploaded).
            </p>
          </div>
        </div>

        <ImageUploader
          existingMedia={normalizedMedia}
          onUploadFile={handleUploadPhoto}
          onSetCoverExisting={handleSetCoverPhoto}
          onDeleteExisting={handleDeletePhoto}
          onReorderExisting={handleReorderPhoto}
          onStagedFilesChange={(newFiles) => {
            if (newFiles.length > 0) {
              const latest = newFiles[newFiles.length - 1];
              handleUploadPhoto(latest);
            }
          }}
        />
      </section>

      {/* SECTION 2: RENTABLE SPACES */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-2xl font-bold text-ink">Rentable Spaces</h2>
            <p className="text-xs sm:text-sm text-body mt-0.5">
              Individual rooms, suites, desks, and workshops listed within this property.
            </p>
          </div>
          <Link to={`/owner/properties/${id}/spaces/new`}>
            <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />}>
              Add Space
            </Button>
          </Link>
        </div>

        {spacesList.length === 0 ? (
          <div className="p-8 sm:p-12 rounded-2xl bg-sand/40 border border-border text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center mx-auto text-primary shadow-warm-xs">
              <Layers className="w-6 h-6 stroke-[1.75]" />
            </div>
            <p className="font-serif text-lg font-semibold text-ink">No spaces added yet</p>
            <p className="text-body text-xs sm:text-sm max-w-sm mx-auto">
              Add individual rooms, desks, or offices to this property so guests can make reservations.
            </p>
            <div className="pt-1">
              <Link to={`/owner/properties/${id}/spaces/new`}>
                <Button variant="primary" size="sm" leftIcon={<Plus className="w-4 h-4" />}>
                  Add Your First Space
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-border divide-y divide-border overflow-hidden shadow-warm-xs">
            {spacesList.map((space) => (
              <div
                key={space.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-sand/30 transition-colors"
              >
                <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
                  {/* Space Thumbnail (4:3 ratio, uniform sizing) */}
                  <div
                    className="w-18 sm:w-20 h-14 sm:h-16 rounded-xl overflow-hidden bg-sand border border-border shrink-0"
                    style={{ aspectRatio: '4/3' }}
                  >
                    {space.coverImageUrl ? (
                      <img src={space.coverImageUrl} alt={space.name} className="w-full h-full object-cover" />
                    ) : (
                      <PlaceholderImage spaceType={space.spaceType} title={space.name} className="w-full h-full" aspectRatio="4/3" />
                    )}
                  </div>

                  {/* Space Info */}
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-serif text-base font-semibold text-ink truncate">
                        {space.name}
                      </span>
                      <StatusBadge status={space.status} size="xs" />
                      {space.spaceType && (
                        <Badge variant="outline" size="xs">
                          {space.spaceType}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-body flex-wrap">
                      <span>Up to {space.capacity} guests</span>
                      <span>•</span>
                      <Price amount={space.priceAmount} period={space.priceUnit ? space.priceUnit.toLowerCase() : 'hour'} size="sm" />
                    </div>
                  </div>
                </div>

                {/* Space Action Buttons */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      const newStatus = space.status === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';
                      toggleSpaceStatusMutation.mutate({ spaceId: space.id, newStatus });
                    }}
                  >
                    {space.status === 'AVAILABLE' ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Link to={`/owner/spaces/${space.id}/edit`}>
                    <Button variant="outline" size="xs" leftIcon={<Edit3 className="w-3 h-3" />}>
                      Edit
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      setSpaceToDelete(space);
                      setDeleteSpaceId(space.id);
                    }}
                    className="text-danger hover:text-danger hover:bg-danger/10"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SECTION 3: PENDING BOOKINGS FOR THIS PROPERTY */}
      <section className="bg-card rounded-2xl border border-border p-6 shadow-warm-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-xl font-semibold text-ink flex items-center gap-2">
              <Clock className="w-5 h-5 text-warning" />
              <span>Pending Booking Requests</span>
            </h2>
            <p className="text-xs text-body mt-0.5">
              Reservations requiring your approval ({pendingBookings.length} awaiting response).
            </p>
          </div>
          <Link
            to={`/owner/bookings?propertyId=${id}`}
            className="text-xs font-semibold uppercase tracking-wider text-primary hover:text-primary-hover flex items-center gap-1 focus-ring rounded py-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {pendingBookings.length === 0 ? (
          <p className="text-body text-xs sm:text-sm py-4 text-center">
            No pending booking requests for this property at this moment.
          </p>
        ) : (
          <div className="divide-y divide-border border-t border-border">
            {pendingBookings.map((b) => (
              <div key={b.id} className="py-3 flex items-center justify-between gap-4">
                <div className="space-y-0.5 min-w-0">
                  <p className="font-semibold text-ink text-sm truncate">
                    {b.space?.name || 'Space reservation'}
                  </p>
                  <p className="text-xs text-body">
                    {formatKolkataDate(b.startAt)} • {formatKolkataTime(b.startAt)} - {formatKolkataTime(b.endAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Price amount={b.totalAmount} size="sm" />
                  <Link to={`/owner/bookings/${b.id}`}>
                    <Button variant="outline" size="xs">
                      Review
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Confirm Status Change Sheet */}
      <ConfirmSheet
        isOpen={confirmStatusOpen}
        onClose={() => setConfirmStatusOpen(false)}
        onConfirm={() => {
          const targetStatus = property.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
          toggleStatusMutation.mutate(targetStatus);
        }}
        title={property.status === 'ACTIVE' ? 'Set Property Inactive?' : 'Activate Property?'}
        description={
          property.status === 'ACTIVE'
            ? 'Setting this property to inactive will hide all of its spaces from public search results.'
            : 'Activating this property will allow its available spaces to be booked by customers.'
        }
        confirmLabel={property.status === 'ACTIVE' ? 'Set Inactive' : 'Activate'}
        variant={property.status === 'ACTIVE' ? 'warning' : 'primary'}
        isLoading={toggleStatusMutation.isPending}
      />

      {/* Confirm Remove Property Sheet */}
      <ConfirmSheet
        isOpen={deletePropertyOpen}
        onClose={() => {
          setDeletePropertyOpen(false);
          setActiveBookingError(null);
        }}
        onConfirm={() => deletePropertyMutation.mutate()}
        title="Remove Property Listing?"
        description="Removing this listing will archive the property and mark all of its child spaces unavailable. Historic booking receipts and expense ledgers remain preserved."
        confirmLabel="Remove Listing"
        variant="danger"
        isLoading={deletePropertyMutation.isPending}
        error={activeBookingError}
      />

      {/* Confirm Delete Space Sheet */}
      <ConfirmSheet
        isOpen={Boolean(deleteSpaceId)}
        onClose={() => {
          setDeleteSpaceId(null);
          setSpaceToDelete(null);
        }}
        onConfirm={() => {
          if (deleteSpaceId) deleteSpaceMutation.mutate(deleteSpaceId);
        }}
        title={`Remove "${spaceToDelete?.name || 'Space'}"?`}
        description="Removing this space marks it unavailable for future reservations. Past confirmed bookings remain on file."
        confirmLabel="Remove Space"
        variant="danger"
        isLoading={deleteSpaceMutation.isPending}
      />
    </div>
  );
}
