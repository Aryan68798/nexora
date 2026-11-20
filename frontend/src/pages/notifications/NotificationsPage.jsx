import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Calendar,
  CreditCard,
  Star,
  CheckCheck,
  RotateCcw,
  Info,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { api } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { Skeleton } from '../../components/ui/Skeleton';
import { Pagination } from '../../components/ui/Pagination';
import { useToast } from '../../components/ui/Toast';
import { SwipeRow } from '../../components/native/SwipeRow';
import { ContextMenu } from '../../components/native/ContextMenu';
import { CollapsingTitle } from '../../components/native/CollapsingTitle';
import { formatRelativeTime, cn } from '../../lib/utils';

/**
 * Returns matching icon based on notification type
 */
function getNotificationIcon(type) {
  switch (type) {
    case 'BOOKING_REQUESTED':
    case 'BOOKING_CONFIRMED':
    case 'BOOKING_COMPLETED':
      return <Calendar className="w-5 h-5 text-primary" />;
    case 'BOOKING_CANCELLED':
    case 'BOOKING_REJECTED':
      return <RotateCcw className="w-5 h-5 text-danger" />;
    case 'PAYMENT_RECEIVED':
      return <CreditCard className="w-5 h-5 text-success" />;
    case 'PAYMENT_REFUNDED':
      return <RotateCcw className="w-5 h-5 text-amber" />;
    case 'REVIEW_RECEIVED':
      return <Star className="w-5 h-5 text-amber" />;
    default:
      return <Info className="w-5 h-5 text-primary" />;
  }
}

export function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['notifications', { unreadOnly, page }],
    queryFn: () => {
      const params = {
        page,
        pageSize: 10,
      };
      if (unreadOnly) {
        params.unread = true;
      }
      return api.get('/api/notifications', { params });
    },
    staleTime: 15 * 1000,
  });

  const notifications = data?.data || (Array.isArray(data) ? data : []);
  const meta = data?.meta || { page, pageSize: 10, total: notifications.length, totalPages: 1 };

  // Mark single notification read
  const markReadMutation = useMutation({
    mutationFn: (id) => api.patch(`/api/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-notifications-count'] });
    },
  });

  // Mark all read
  const markAllReadMutation = useMutation({
    mutationFn: () => api.post('/api/notifications/read-all'),
    onSuccess: () => {
      toast.success('All notifications marked as read');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['unread-notifications-count'] });
      refetch();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to mark all as read');
    },
  });

  const handleNotificationClick = async (notification) => {
    // If unread, mark read
    if (!notification.readAt) {
      markReadMutation.mutate(notification.id);
    }

    // Determine target link
    const targetLink = notification.linkUrl;
    if (targetLink) {
      if (targetLink.startsWith('http')) {
        window.location.href = targetLink;
      } else {
        navigate(targetLink);
      }
    }
  };

  const hasUnread = notifications.some((n) => !n.readAt);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header with CollapsingTitle */}
      <CollapsingTitle
        title="Notifications"
        subtitle="Real-time updates regarding your reservations, payments, and host communications."
        actions={
          <div className="flex items-center gap-3">
            {hasUnread && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => markAllReadMutation.mutate()}
                loading={markAllReadMutation.isPending}
                leftIcon={<CheckCheck className="w-4 h-4" />}
              >
                Mark all read
              </Button>
            )}

            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-2.5 rounded-xl border border-border bg-card hover:bg-sand text-body hover:text-ink transition-colors focus-ring"
              aria-label="Refresh notifications"
            >
              <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
            </button>
          </div>
        }
      />

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-3">
        <button
          type="button"
          onClick={() => {
            setUnreadOnly(false);
            setPage(1);
          }}
          className={cn(
            'px-4 py-1.5 rounded-xl text-xs font-semibold tracking-wider uppercase transition-all focus-ring',
            !unreadOnly
              ? 'bg-primary text-white shadow-warm-xs'
              : 'bg-card border border-border text-body hover:text-ink'
          )}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => {
            setUnreadOnly(true);
            setPage(1);
          }}
          className={cn(
            'px-4 py-1.5 rounded-xl text-xs font-semibold tracking-wider uppercase transition-all focus-ring',
            unreadOnly
              ? 'bg-primary text-white shadow-warm-xs'
              : 'bg-card border border-border text-body hover:text-ink'
          )}
        >
          Unread only
        </button>
      </div>

      {/* Main List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="p-4 rounded-2xl bg-card border border-border flex items-start gap-4">
              <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="w-1/3 h-4 rounded" />
                <Skeleton className="w-3/4 h-3 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="Unable to load notifications"
          message={error?.message || 'A network error occurred while retrieving notifications.'}
          onRetry={refetch}
        />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={unreadOnly ? 'No unread notifications' : 'No notifications yet'}
          description={
            unreadOnly
              ? 'You are completely caught up! Toggle to "All" to inspect your notification history.'
              : 'You will receive updates here whenever a booking is confirmed, paid, or updated.'
          }
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {notifications.map((n) => {
              const isUnread = !n.readAt;
              const hasLink = Boolean(n.linkUrl);

              const menuItems = [
                ...(isUnread
                  ? [
                      {
                        label: 'Mark as read',
                        icon: CheckCheck,
                        onClick: () => markReadMutation.mutate(n.id),
                      },
                    ]
                  : []),
                ...(hasLink
                  ? [
                      {
                        label: 'Open notification',
                        icon: ExternalLink,
                        onClick: () => handleNotificationClick(n),
                      },
                    ]
                  : []),
              ];

              return (
                <motion.div
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <SwipeRow
                    onAction={() => {
                      if (isUnread) markReadMutation.mutate(n.id);
                    }}
                    actionLabel={isUnread ? 'Mark read' : 'Read'}
                    actionIcon={<CheckCheck className="w-4 h-4" />}
                    actionVariant="primary"
                  >
                    <ContextMenu
                      items={menuItems}
                      buttonLabel={`Options for ${n.title}`}
                      buttonClassName="top-3.5 right-3.5"
                    >
                      <div
                        onClick={() => handleNotificationClick(n)}
                        className={cn(
                          'group p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex items-start gap-3 sm:gap-4',
                          hasLink && 'cursor-pointer hover:shadow-warm-sm',
                          isUnread
                            ? 'bg-card border-primary/40 shadow-warm-xs'
                            : 'bg-sand/30 border-border opacity-90 hover:opacity-100 hover:bg-card'
                        )}
                      >
                        {/* Icon */}
                        <div
                          className={cn(
                            'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border',
                            isUnread
                              ? 'bg-primary/10 border-primary/20'
                              : 'bg-sand border-border'
                          )}
                        >
                          {getNotificationIcon(n.type)}
                        </div>

                        {/* Body */}
                        <div className="flex-1 min-w-0 pr-8">
                          <div className="flex items-baseline justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              {isUnread && (
                                <span
                                  className="w-2 h-2 rounded-full bg-primary shrink-0"
                                  aria-label="Unread notification"
                                />
                              )}
                              <h4
                                className={cn(
                                  'text-sm truncate',
                                  isUnread ? 'font-bold text-ink' : 'font-semibold text-ink/90'
                                )}
                              >
                                {n.title}
                              </h4>
                            </div>
                            <span className="text-2xs text-body shrink-0">
                              {formatRelativeTime(n.createdAt)}
                            </span>
                          </div>

                          <p className="text-xs text-body leading-relaxed line-clamp-2">
                            {n.message}
                          </p>
                        </div>

                        {/* Link indicator */}
                        {hasLink && (
                          <ExternalLink className="w-4 h-4 text-body/50 group-hover:text-primary shrink-0 self-center transition-colors" />
                        )}
                      </div>
                    </ContextMenu>
                  </SwipeRow>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {meta.totalPages > 1 && (
            <div className="pt-4">
              <Pagination
                currentPage={meta.page}
                totalPages={meta.totalPages}
                onPageChange={(newPage) => {
                  setPage(newPage);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
