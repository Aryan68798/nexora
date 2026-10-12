import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client';
import { formatKolkata } from '../../lib/utils';
import { useToast } from '../../components/ui/Toast';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Card } from '../../components/ui/Card';
import {
  Search,
} from 'lucide-react';

export function AdminUsersPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  const { data: usersData, isLoading, error } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      const res = await api.get('/api/admin/users?pageSize=100');
      return res?.data || res || [];
    },
  });

  const users = Array.isArray(usersData) ? usersData : [];

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, updates }) => {
      return api.patch(`/api/admin/users/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
      queryClient.invalidateQueries({ queryKey: ['adminDashboard'] });
      toast.success('User updated successfully.');
    },
    onError: (err) => {
      toast.error(err?.message || 'Failed to update user profile');
    },
  });

  const handleToggleActive = (user) => {
    updateUserMutation.mutate({
      id: user.id,
      updates: { isActive: !user.is_active },
    });
  };

  const handleRoleChange = (user, newRole) => {
    if (newRole === user.role) return;
    updateUserMutation.mutate({
      id: user.id,
      updates: { role: newRole },
    });
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !searchTerm ||
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-6">
        <div>
          <h1 className="font-editorial text-3xl font-bold text-ink">
            User &amp; Role Administration
          </h1>
          <p className="text-body text-sm mt-1">
            Manage account permissions, modify roles, and toggle platform access controls.
          </p>
        </div>
      </div>

      {/* Search & Role Filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-body absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or email..."
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-sand/50 border border-border rounded-xl self-start sm:self-auto">
          {['ALL', 'CUSTOMER', 'OWNER', 'PROVIDER', 'ADMIN'].map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${roleFilter === r
                ? 'bg-card text-ink shadow-sm'
                : 'text-body hover:text-ink'
                }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Card className="p-12 text-center text-body">Loading user profiles...</Card>
      ) : error ? (
        <Card className="p-8 text-center text-danger border-danger/30">
          Failed to load users directory.
        </Card>
      ) : filteredUsers.length === 0 ? (
        <Card className="p-12 text-center text-body">
          No user accounts found matching your query.
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((u) => {
            const isActive = u.is_active !== false;

            return (
              <Card
                key={u.id}
                className="p-5 bg-card border border-border rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 transition-shadow hover:shadow-sm"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-base font-bold text-ink truncate">
                      {u.name || 'Unnamed User'}
                    </h2>

                    <StatusBadge status={isActive ? 'ACTIVE' : 'INACTIVE'} />
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-body">
                    <span className="text-ink">{u.email}</span>
                    {u.created_at && (
                      <span className="text-body/80">
                        Joined: {formatKolkata(u.created_at)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Role dropdown & Active Toggle */}
                <div className="flex items-center gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-border/60">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-body font-medium">Role:</span>
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u, e.target.value)}
                      disabled={updateUserMutation.isPending}
                      className="px-2.5 py-1.5 text-xs text-ink bg-card border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                    >
                      <option value="CUSTOMER">CUSTOMER</option>
                      <option value="OWNER">OWNER</option>
                      <option value="PROVIDER">PROVIDER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </div>

                  <Button
                    type="button"
                    variant={isActive ? 'outline' : 'primary'}
                    onClick={() => handleToggleActive(u)}
                    disabled={updateUserMutation.isPending}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl ${isActive
                      ? 'text-danger border-border hover:bg-danger/10'
                      : 'bg-primary text-white'
                      }`}
                  >
                    {isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AdminUsersPage;
