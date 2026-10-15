import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DollarSign,
  Plus,
  Receipt,
  RotateCcw,
  Calendar,
  Trash2,
  X,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { api } from '../../api/client';
import { formatINR } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { CollapsingTitle } from '../../components/native/CollapsingTitle';
import { useToast } from '../../components/ui/Toast';

export function OwnerExpensesPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [receiptModalExpense, setReceiptModalExpense] = useState(null);
  const [receiptFile, setReceiptFile] = useState(null);

  // Form states
  const [expensePropertyId, setExpensePropertyId] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [incurredOn, setIncurredOn] = useState(new Date().toISOString().split('T')[0]);
  const [formError, setFormError] = useState('');

  // Fetch valid categories from API
  const { data: categoriesData } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: async () => {
      const res = await api.get('/api/expenses/categories');
      return res.data || [];
    },
  });

  const categories = React.useMemo(() => {
    const list = Array.isArray(categoriesData?.data)
      ? categoriesData.data
      : Array.isArray(categoriesData)
      ? categoriesData
      : [];
    const stringsOnly = list.filter((c) => typeof c === 'string');
    if (stringsOnly.length > 0) {
      return stringsOnly;
    }
    return ['MAINTENANCE', 'UTILITIES', 'TAXES', 'INSURANCE', 'CLEANING', 'SUPPLIES', 'SALARY', 'OTHER'];
  }, [categoriesData]);

  React.useEffect(() => {
    if (categories.length > 0 && !category) {
      setCategory(categories[0]);
    }
  }, [categories, category]);

  // Fetch properties for selector (use /mine for OWNER role)
  const { data: propertiesData } = useQuery({
    queryKey: ['owner-properties-list-minimal'],
    queryFn: async () => {
      const res = await api.get('/api/properties/mine');
      return res.data || [];
    },
  });

  const properties = React.useMemo(() => propertiesData || [], [propertiesData]);

  // Initialize selected property
  React.useEffect(() => {
    if (properties.length > 0 && !selectedPropertyId) {
      setSelectedPropertyId(properties[0].id);
      setExpensePropertyId(properties[0].id);
    }
  }, [properties, selectedPropertyId]);

  const activePropertyId = selectedPropertyId || (properties.length > 0 ? properties[0].id : null);

  // Fetch expenses for the active property
  const {
    data: expensesData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['owner-property-expenses', activePropertyId, selectedCategory],
    queryFn: async () => {
      if (!activePropertyId) return { data: [], totalAmount: '0.00' };
      const params = new URLSearchParams();
      params.set('limit', '100');
      if (selectedCategory) {
        params.set('category', selectedCategory);
      }
      const res = await api.get(`/api/properties/${activePropertyId}/expenses?${params.toString()}`);
      return res;
    },
    enabled: Boolean(activePropertyId),
  });

  const expenses = expensesData?.data || [];
  const totalAmount = expensesData?.totalAmount || '0.00';

  // Record expense mutation
  const recordMutation = useMutation({
    mutationFn: async (payload) => {
      return await api.post(`/api/properties/${payload.propertyId}/expenses`, {
        category: payload.category,
        description: payload.description,
        amount: payload.amount,
        incurredOn: payload.incurredOn,
      });
    },
    onSuccess: () => {
      toast({
        title: 'Expense Recorded',
        description: 'New operational expense added to the ledger.',
        variant: 'success',
      });
      setIsRecordModalOpen(false);
      setDescription('');
      setAmount('');
      setFormError('');
      queryClient.invalidateQueries({ queryKey: ['owner-property-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['owner-dashboard-metrics'] });
    },
    onError: (err) => {
      setFormError(err.message || 'Failed to record expense');
    },
  });

  // Delete expense mutation
  const deleteMutation = useMutation({
    mutationFn: async (expenseId) => {
      return await api.delete(`/api/expenses/${expenseId}`);
    },
    onSuccess: () => {
      toast({
        title: 'Expense Deleted',
        description: 'Record removed from ledger.',
        variant: 'success',
      });
      queryClient.invalidateQueries({ queryKey: ['owner-property-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['owner-dashboard-metrics'] });
    },
    onError: (err) => {
      toast({ title: 'Delete Failed', description: err.message, variant: 'danger' });
    },
  });

  // Upload receipt mutation
  const uploadReceiptMutation = useMutation({
    mutationFn: async () => {
      if (!receiptFile || !receiptModalExpense) throw new Error('Please select a receipt file.');
      const formData = new FormData();
      formData.append('file', receiptFile);
      return await api.post(`/api/expenses/${receiptModalExpense.id}/receipt`, formData);
    },
    onSuccess: () => {
      toast({
        title: 'Receipt Uploaded',
        description: 'Proof of expense safely stored.',
        variant: 'success',
      });
      setReceiptModalExpense(null);
      setReceiptFile(null);
      queryClient.invalidateQueries({ queryKey: ['owner-property-expenses'] });
    },
    onError: (err) => {
      toast({ title: 'Upload Failed', description: err.message, variant: 'danger' });
    },
  });

  // Delete receipt mutation
  const deleteReceiptMutation = useMutation({
    mutationFn: async (expenseId) => {
      return await api.delete(`/api/expenses/${expenseId}/receipt`);
    },
    onSuccess: () => {
      toast({
        title: 'Receipt Deleted',
        description: 'Receipt removed from storage.',
        variant: 'success',
      });
      setReceiptModalExpense(null);
      queryClient.invalidateQueries({ queryKey: ['owner-property-expenses'] });
    },
    onError: (err) => {
      toast({ title: 'Delete Failed', description: err.message, variant: 'danger' });
    },
  });

  const handleRecordSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    if (!expensePropertyId) {
      setFormError('Please select a property.');
      return;
    }
    if (!description.trim() || description.trim().length < 3) {
      setFormError('Description must be at least 3 characters.');
      return;
    }
    const amtNum = Number(amount);
    if (isNaN(amtNum) || amtNum <= 0) {
      setFormError('Please enter a valid amount greater than 0.');
      return;
    }
    if (!incurredOn) {
      setFormError('Please select the date incurred.');
      return;
    }

    recordMutation.mutate({
      propertyId: expensePropertyId,
      category,
      description: description.trim(),
      amount: String(amount),
      incurredOn,
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Title & Actions */}
      <CollapsingTitle
        title="Property Expenses Ledger"
        subtitle="Operational costs, maintenance expenditures, utilities, taxes, and receipt audits."
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
                setIsRecordModalOpen(true);
              }}
              className="gap-2 shrink-0 min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>Record Expense</span>
            </Button>
          </div>
        }
      />

      {/* Summary KPI Banner */}
      <div className="p-6 rounded-2xl bg-card border border-border shadow-warm-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-medium text-body uppercase tracking-wider block">
            Total Operational Outflow
          </span>
          <div className="text-2xl sm:text-3xl font-bold font-sans text-ink mt-1">
            {formatINR(totalAmount)}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Filter by category"
            className="appearance-none rounded-xl border border-border bg-sand/30 px-3.5 py-2 text-xs sm:text-sm font-medium text-ink focus:outline-none focus:border-primary min-h-[44px] cursor-pointer"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Expenses List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 rounded-2xl bg-sand/40 animate-pulse border border-border/50" />
          ))}
        </div>
      ) : isError ? (
        <div className="p-8 rounded-2xl bg-danger/10 border border-danger/30 text-center space-y-3">
          <p className="font-semibold text-danger">
            {error?.message || 'Unable to load property expenses.'}
          </p>
          <Button variant="secondary" size="sm" onClick={() => refetch()} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            <span>Try Again</span>
          </Button>
        </div>
      ) : expenses.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card space-y-3">
          <div className="w-12 h-12 rounded-xl bg-sand/60 text-body flex items-center justify-center mx-auto">
            <DollarSign className="w-6 h-6" />
          </div>
          <h3 className="font-sans font-semibold text-ink text-base">No expenses recorded</h3>
          <p className="text-body text-xs sm:text-sm max-w-md mx-auto">
            {selectedCategory
              ? `No expenses found in category ${selectedCategory}.`
              : 'Keep track of operational repairs, utility bills, taxes, and service fees in one ledger.'}
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsRecordModalOpen(true)}
            className="mt-2 min-h-[44px]"
          >
            Record First Expense
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {expenses.map((exp) => (
            <div
              key={exp.id}
              className="p-5 rounded-2xl bg-card border border-border shadow-warm-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="neutral">{exp.category}</Badge>
                  <span className="font-sans font-semibold text-ink text-sm sm:text-base">
                    {exp.description}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-body flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-body" />
                    Incurred {exp.incurredOn}
                  </span>

                  {exp.maintenanceTitle && (
                    <span className="flex items-center gap-1 text-primary font-medium">
                      <FileText className="w-3.5 h-3.5" />
                      Job: {exp.maintenanceTitle}
                    </span>
                  )}

                  {exp.hasReceipt && (
                    <span className="flex items-center gap-1 text-success font-medium">
                      <Receipt className="w-3.5 h-3.5" />
                      Receipt Verified
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0 self-end sm:self-center">
                <div className="text-right">
                  <span className="text-base sm:text-lg font-bold text-ink">
                    {formatINR(exp.amount)}
                  </span>
                </div>

                {/* Receipt Action Button */}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setReceiptModalExpense(exp)}
                  className="gap-1 min-h-[38px]"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>{exp.hasReceipt ? 'Receipt' : 'Add Receipt'}</span>
                </Button>

                {/* Delete Expense Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this expense record?')) {
                      deleteMutation.mutate(exp.id);
                    }
                  }}
                  className="p-2 rounded-xl text-body hover:text-danger hover:bg-danger/10 transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center"
                  aria-label="Delete expense"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Record Expense Modal */}
      {isRecordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40">
          <div className="relative w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-warm-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-editorial text-xl font-bold text-ink">Record Property Expense</h3>
                <p className="text-xs text-body">Add a maintenance, utility, or operational cost.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsRecordModalOpen(false)}
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

            <form onSubmit={handleRecordSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-ink">Property</label>
                <select
                  value={expensePropertyId}
                  onChange={(e) => setExpensePropertyId(e.target.value)}
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

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-ink">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:border-primary min-h-[44px]"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-ink">Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="100000000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:border-primary min-h-[44px]"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-ink">Incurred On Date</label>
                <input
                  type="date"
                  value={incurredOn}
                  onChange={(e) => setIncurredOn(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:border-primary min-h-[44px]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-ink">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Monthly elevator safety service fee"
                  minLength={3}
                  maxLength={1000}
                  className="w-full rounded-xl border border-border bg-card px-3.5 py-2 text-xs sm:text-sm text-ink focus:outline-none focus:border-primary min-h-[44px]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsRecordModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={recordMutation.isPending}
                >
                  Save Expense
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {receiptModalExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40">
          <div className="relative w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-warm-lg space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-editorial text-xl font-bold text-ink">Proof Receipt</h3>
                <p className="text-xs text-body">{receiptModalExpense.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setReceiptModalExpense(null)}
                className="w-8 h-8 rounded-xl border border-border flex items-center justify-center text-body hover:text-ink"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {receiptModalExpense.receiptUrl ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-border overflow-hidden bg-sand/20 aspect-video flex items-center justify-center">
                  <img
                    src={receiptModalExpense.receiptUrl}
                    alt="Expense receipt"
                    className="max-h-60 object-contain"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => deleteReceiptMutation.mutate(receiptModalExpense.id)}
                    isLoading={deleteReceiptMutation.isPending}
                  >
                    Delete Receipt
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setReceiptModalExpense(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-ink">Upload Receipt Image or PDF</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                    className="w-full text-xs text-body file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border file:border-border file:text-xs file:font-medium file:bg-sand/30 file:text-ink hover:file:bg-sand/50 cursor-pointer min-h-[44px]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setReceiptModalExpense(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => uploadReceiptMutation.mutate()}
                    isLoading={uploadReceiptMutation.isPending}
                    disabled={!receiptFile}
                  >
                    Upload Receipt
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

