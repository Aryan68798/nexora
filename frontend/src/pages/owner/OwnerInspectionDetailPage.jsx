import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardCheck,
  Calendar,
  CheckCircle2,
  RotateCcw,
  ArrowLeft,
  Camera,
  Save,
  X,
  Sparkles,
  Plus,
  Trash2,
} from 'lucide-react';
import { api } from '../../api/client';
import { formatKolkata, cn } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { CollapsingTitle } from '../../components/native/CollapsingTitle';
import { useToast } from '../../components/ui/Toast';

const CONDITIONS = [
  { id: 'EXCELLENT', label: 'Excellent', score: 100, color: 'text-success border-success/40 bg-success/10' },
  { id: 'GOOD', label: 'Good', score: 75, color: 'text-success border-success/40 bg-success/5' },
  { id: 'FAIR', label: 'Fair', score: 50, color: 'text-warning border-warning/40 bg-warning/10' },
  { id: 'POOR', label: 'Poor', score: 25, color: 'text-danger border-danger/40 bg-danger/10' },
  { id: 'CRITICAL', label: 'Critical', score: 0, color: 'text-danger border-danger/60 bg-danger/20 font-bold' },
];



export function OwnerInspectionDetailPage() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [items, setItems] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoCaption, setPhotoCaption] = useState('');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  // Fetch Inspection details
  const {
    data: inspectionData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['owner-inspection-detail', id],
    queryFn: async () => {
      const res = await api.get(`/api/inspections/${id}`);
      return res.data || res;
    },
    enabled: Boolean(id),
  });

  const inspection = inspectionData || {};

  // Initialize local checklist items when inspection loads
  useEffect(() => {
    if (inspection?.items && Array.isArray(inspection.items)) {
      setItems(inspection.items);
      setHasUnsavedChanges(false);
    }
  }, [inspection?.items]);

  // Fetch standard template if items array is empty
  const loadTemplateMutation = useMutation({
    mutationFn: async () => {
      const res = await api.get('/api/inspections/templates');
      return res.data || [];
    },
    onSuccess: (templates) => {
      const initialItems = templates.map((t) => ({
        itemName: t.itemName,
        category: t.category,
        condition: 'GOOD',
        notes: '',
      }));
      setItems(initialItems);
      setHasUnsavedChanges(true);
      toast({
        title: 'Template Loaded',
        description: `Loaded ${initialItems.length} checklist inspection items.`,
        variant: 'success',
      });
    },
    onError: (err) => {
      toast({
        title: 'Failed to load template',
        description: err.message,
        variant: 'danger',
      });
    },
  });

  // Save checklist items mutation
  const saveItemsMutation = useMutation({
    mutationFn: async (updatedItems) => {
      const payload = {
        items: updatedItems.map((item) => ({
          itemName: item.itemName,
          category: item.category,
          condition: item.condition,
          notes: item.notes || null,
        })),
      };
      return await api.put(`/api/inspections/${id}/items`, payload);
    },
    onSuccess: () => {
      setHasUnsavedChanges(false);
      toast({
        title: 'Checklist Saved',
        description: 'Inspection checklist evaluation has been updated.',
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['owner-inspection-detail', id] });
    },
    onError: (err) => {
      toast({
        title: 'Save Failed',
        description: err.message || 'Unable to save checklist.',
        variant: 'danger',
      });
    },
  });

  // Complete inspection mutation
  const completeMutation = useMutation({
    mutationFn: async () => {
      return await api.post(`/api/inspections/${id}/complete`, {});
    },
    onSuccess: () => {
      toast({
        title: 'Inspection Completed',
        description: 'Inspection finalized and overall property health score calculated.',
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['owner-inspection-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['owner-inspections'] });
      queryClient.invalidateQueries({ queryKey: ['owner-dashboard-metrics'] });
    },
    onError: (err) => {
      toast({
        title: 'Completion Failed',
        description: err.message || 'Unable to complete inspection.',
        variant: 'danger',
      });
    },
  });

  // Cancel inspection mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      return await api.post(`/api/inspections/${id}/cancel`);
    },
    onSuccess: () => {
      toast({
        title: 'Inspection Cancelled',
        description: 'Inspection status updated to CANCELLED.',
        variant: 'success',
      });
      setCancelModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['owner-inspection-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['owner-inspections'] });
    },
    onError: (err) => {
      toast({
        title: 'Cancellation Failed',
        description: err.message || 'Unable to cancel inspection.',
        variant: 'danger',
      });
    },
  });

  // Upload photo mutation
  const uploadPhotoMutation = useMutation({
    mutationFn: async () => {
      if (!photoFile) throw new Error('Please select an image file to upload.');
      const formData = new FormData();
      formData.append('file', photoFile);
      if (photoCaption.trim()) {
        formData.append('caption', photoCaption.trim());
      }
      return await api.post(`/api/inspections/${id}/media`, formData);
    },
    onSuccess: () => {
      toast({
        title: 'Photo Uploaded',
        description: 'Inspection photo evidence added.',
        variant: 'success',
      });
      setPhotoFile(null);
      setPhotoCaption('');
      setIsUploadModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['owner-inspection-detail', id] });
    },
    onError: (err) => {
      toast({
        title: 'Upload Failed',
        description: err.message || 'Could not upload photo.',
        variant: 'danger',
      });
    },
  });

  const handleConditionChange = (index, condition) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], condition };
      return next;
    });
    setHasUnsavedChanges(true);
  };

  const handleNoteChange = (index, notes) => {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], notes };
      return next;
    });
    setHasUnsavedChanges(true);
  };

  const handleAddItem = () => {
    if (items.length >= 100) {
      toast({
        title: 'Item Limit Reached',
        description: 'Checklist cannot exceed 100 items.',
        variant: 'danger',
      });
      return;
    }
    const newItemNumber = items.length + 1;
    setItems((prev) => [
      ...prev,
      {
        itemName: `Custom Inspection Item ${newItemNumber}`,
        category: 'GENERAL',
        condition: 'GOOD',
        notes: '',
      },
    ]);
    setHasUnsavedChanges(true);
  };

  const handleRemoveItem = (index) => {
    if (items.length <= 1) {
      toast({
        title: 'Minimum Items Required',
        description: 'Checklist must contain at least 1 inspection item.',
        variant: 'danger',
      });
      return;
    }
    setItems((prev) => prev.filter((_, idx) => idx !== index));
    setHasUnsavedChanges(true);
  };

  const handleSaveChecklist = () => {
    if (items.length < 1 || items.length > 100) {
      toast({
        title: 'Invalid Checklist Size',
        description: 'Checklist must contain between 1 and 100 items.',
        variant: 'danger',
      });
      return;
    }
    saveItemsMutation.mutate(items);
  };

  const isEditable = inspection.status === 'SCHEDULED' || inspection.status === 'IN_PROGRESS';
  const hasScore = inspection.score !== null && inspection.score !== undefined;

  return (
    <div className="space-y-6 pb-16">
      {/* Back Link */}
      <div className="flex items-center gap-2">
        <Link
          to="/owner/inspections"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-body hover:text-ink transition-colors min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Inspections</span>
        </Link>
      </div>

      {/* Header */}
      <CollapsingTitle
        title={`Inspection #${id?.slice(0, 8)}`}
        subtitle={
          inspection.property?.title
            ? `${inspection.property.title} - ${inspection.property.city || ''}`
            : 'Asset physical checklist and condition breakdown.'
        }
        actions={
          <div className="flex items-center gap-3">
            {isEditable && (
              <>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => setIsUploadModalOpen(true)}
                  className="gap-2 min-h-[44px]"
                >
                  <Camera className="w-4 h-4" />
                  <span>Add Photo</span>
                </Button>

                {hasUnsavedChanges && (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleSaveChecklist}
                    isLoading={saveItemsMutation.isPending}
                    className="gap-2 min-h-[44px]"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save Checklist</span>
                  </Button>
                )}

                {items.length > 0 && (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => completeMutation.mutate()}
                    isLoading={completeMutation.isPending}
                    className="gap-2 min-h-[44px]"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Complete Inspection</span>
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setCancelModalOpen(true)}
                  className="text-danger hover:bg-danger/10 min-h-[44px]"
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Loading / Error States */}
      {isLoading ? (
        <div className="space-y-4">
          <div className="h-32 rounded-2xl bg-sand/40 animate-pulse border border-border" />
          <div className="h-64 rounded-2xl bg-sand/40 animate-pulse border border-border" />
        </div>
      ) : isError ? (
        <div className="p-8 rounded-2xl bg-danger/10 border border-danger/30 text-center space-y-3">
          <p className="font-semibold text-danger">
            {error?.message || 'Unable to load inspection details.'}
          </p>
          <Button variant="secondary" size="sm" onClick={() => refetch()} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            <span>Try Again</span>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Status & Health Grade Banner */}
          <div className="p-6 rounded-2xl bg-card border border-border shadow-warm-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <StatusBadge status={inspection.status} />
                  {hasScore && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          inspection.grade === 'A' || inspection.grade === 'B'
                            ? 'bg-success'
                            : inspection.grade === 'C'
                              ? 'bg-warning'
                              : 'bg-danger'
                        }`}
                      />
                      Grade {inspection.grade}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-body flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-body" />
                    Scheduled: {inspection.scheduledAt ? formatKolkata(inspection.scheduledAt, 'dd MMM yyyy, hh:mm a') : 'N/A'}
                  </span>
                  {inspection.completedAt && (
                    <span className="flex items-center gap-1.5 text-success">
                      <CheckCircle2 className="w-4 h-4" />
                      Completed: {formatKolkata(inspection.completedAt, 'dd MMM yyyy, hh:mm a')}
                    </span>
                  )}
                </div>

                {inspection.summary && (
                  <p className="text-xs sm:text-sm text-body pt-1">
                    {inspection.summary}
                  </p>
                )}
              </div>

              {hasScore ? (
                <div className="flex items-center gap-4 p-4 rounded-xl bg-sand/30 border border-border shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-medium text-body">Health Score</div>
                    <div className="text-xs text-body">Asset Condition</div>
                  </div>
                  <div className="text-3xl font-bold font-sans text-ink">
                    {inspection.score}
                    <span className="text-xs font-normal text-body">/100</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-sand/20 border border-border text-xs text-body max-w-xs">
                  Health score and letter grade are calculated automatically upon inspection completion.
                </div>
              )}
            </div>
          </div>

          {/* Media / Photo Evidence Section */}
          {inspection.media && inspection.media.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-editorial text-lg font-bold text-ink">
                Inspection Photos ({inspection.media.length})
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {inspection.media.map((m) => (
                  <div
                    key={m.id}
                    className="group relative rounded-xl border border-border overflow-hidden bg-sand/20 aspect-video flex flex-col justify-end"
                  >
                    <img
                      src={m.mediaUrl || m.url}
                      alt={m.caption || 'Inspection photo'}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    {m.caption && (
                      <div className="relative z-10 p-2 bg-ink/75 text-cream text-[11px] truncate">
                        {m.caption}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Checklist Items Section */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-editorial text-xl font-bold text-ink">
                  Inspection Checklist ({items.length} items)
                </h3>
                <p className="text-xs text-body">
                  Rate each physical element across electrical, plumbing, HVAC, structural, and safety.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {isEditable && items.length === 0 && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => loadTemplateMutation.mutate()}
                    isLoading={loadTemplateMutation.isPending}
                    className="gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Load Standard Template</span>
                  </Button>
                )}

                {isEditable && items.length > 0 && items.length < 100 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleAddItem}
                    className="gap-1.5 min-h-[36px]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </Button>
                )}
              </div>
            </div>

            {items.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-border bg-card space-y-3">
                <ClipboardCheck className="w-8 h-8 text-body mx-auto" />
                <p className="text-xs sm:text-sm text-body">
                  No checklist items initialized for this inspection yet.
                </p>
                {isEditable && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => loadTemplateMutation.mutate()}
                    isLoading={loadTemplateMutation.isPending}
                  >
                    Load Standard Checklist
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-card border border-border shadow-warm-xs space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[11px] font-semibold tracking-wider uppercase text-body/80">
                          {item.category}
                        </span>
                        <h4 className="font-sans font-semibold text-ink text-sm sm:text-base">
                          {item.itemName}
                        </h4>
                      </div>

                      {/* Condition Pickers & Item Delete */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                          {CONDITIONS.map((cond) => {
                            const isSelected = item.condition === cond.id;
                            return (
                              <button
                                key={cond.id}
                                type="button"
                                disabled={!isEditable}
                                onClick={() => handleConditionChange(idx, cond.id)}
                                className={cn(
                                  'px-3 py-1.5 rounded-xl border text-xs font-medium transition-all min-h-[36px]',
                                  isSelected
                                    ? `${cond.color} shadow-warm-xs font-semibold`
                                    : 'border-border text-body hover:bg-sand/30 hover:text-ink'
                                )}
                              >
                                {cond.label}
                              </button>
                            );
                          })}
                        </div>

                        {isEditable && items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="w-8 h-8 rounded-xl border border-border flex items-center justify-center text-body hover:text-danger hover:border-danger/30 transition-colors shrink-0"
                            title="Remove item"
                            aria-label={`Remove ${item.itemName}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Optional Note */}
                    {isEditable ? (
                      <input
                        type="text"
                        value={item.notes || ''}
                        onChange={(e) => handleNoteChange(idx, e.target.value)}
                        placeholder="Add condition notes, repairs needed, or observations..."
                        maxLength={1000}
                        className="w-full rounded-xl border border-border bg-sand/20 px-3 py-2 text-xs text-ink placeholder:text-body/60 focus:outline-none focus:border-primary"
                      />
                    ) : item.notes ? (
                      <p className="text-xs text-body italic pl-1 border-l-2 border-border">
                        {item.notes}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload Photo Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40">
          <div className="relative w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-warm-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-editorial text-xl font-bold text-ink">Upload Photo</h3>
                <p className="text-xs text-body">Attach visual evidence to the inspection checklist.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(false)}
                className="w-8 h-8 rounded-xl border border-border flex items-center justify-center text-body hover:text-ink"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-ink">Image File</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-body file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border file:border-border file:text-xs file:font-medium file:bg-sand/30 file:text-ink hover:file:bg-sand/50 cursor-pointer min-h-[44px]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-ink">Caption / Description</label>
                <input
                  type="text"
                  value={photoCaption}
                  onChange={(e) => setPhotoCaption(e.target.value)}
                  placeholder="e.g. Minor water stains on master bedroom ceiling"
                  maxLength={255}
                  className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:border-primary min-h-[44px]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsUploadModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => uploadPhotoMutation.mutate()}
                  isLoading={uploadPhotoMutation.isPending}
                  disabled={!photoFile}
                >
                  Upload Photo
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Inspection Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40">
          <div className="relative w-full max-w-sm rounded-2xl bg-card border border-border p-6 shadow-warm-lg space-y-4">
            <h3 className="font-editorial text-xl font-bold text-danger">Cancel Inspection</h3>
            <p className="text-xs text-body">
              Are you sure you want to cancel this inspection? This action cannot be reversed.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCancelModalOpen(false)}
              >
                No, Keep
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => cancelMutation.mutate()}
                isLoading={cancelMutation.isPending}
              >
                Yes, Cancel Inspection
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

