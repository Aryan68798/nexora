import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Layouts & Guards
import { PublicLayout } from '../components/layout/PublicLayout';
import { AppLayout } from '../components/layout/AppLayout';
import { ProtectedRoute, RoleRoute, GuestRoute } from './guards';

// Public & Auth Pages
import { LandingPage } from '../pages/LandingPage';
import { ExplorePage } from '../pages/explore/ExplorePage';
import { SpaceDetailPage } from '../pages/spaces/SpaceDetailPage';
import { DesignSystemPage } from '../pages/DesignSystemPage';
import { LoginPage } from '../pages/auth/LoginPage';
import { SignupPage } from '../pages/auth/SignupPage';
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage';
import { AuthCallbackPage } from '../pages/auth/AuthCallbackPage';
import { ProfilePage } from '../pages/account/ProfilePage';
import { MyBookingsPage } from '../pages/bookings/MyBookingsPage';
import { BookingDetailPage } from '../pages/bookings/BookingDetailPage';
import { FavoritesPage } from '../pages/favorites/FavoritesPage';
import { NotificationsPage } from '../pages/notifications/NotificationsPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ComingSoonPage } from '../pages/ComingSoonPage';

// Owner Flow Pages
import { OwnerPropertiesPage } from '../pages/owner/OwnerPropertiesPage';
import { ListPropertyPage } from '../pages/owner/ListPropertyPage';
import { OwnerPropertyDetailPage } from '../pages/owner/OwnerPropertyDetailPage';
import { EditPropertyPage } from '../pages/owner/EditPropertyPage';
import { AddSpacePage } from '../pages/owner/AddSpacePage';
import { EditSpacePage } from '../pages/owner/EditSpacePage';
import { OwnerBookingsPage } from '../pages/owner/OwnerBookingsPage';
import { OwnerBookingDetailPage } from '../pages/owner/OwnerBookingDetailPage';
import { OwnerDashboardPage } from '../pages/owner/OwnerDashboardPage';
import { OwnerInspectionsPage } from '../pages/owner/OwnerInspectionsPage';
import { OwnerInspectionDetailPage } from '../pages/owner/OwnerInspectionDetailPage';
import { OwnerMaintenancePage } from '../pages/owner/OwnerMaintenancePage';
import { OwnerMaintenanceDetailPage } from '../pages/owner/OwnerMaintenanceDetailPage';
import { OwnerExpensesPage } from '../pages/owner/OwnerExpensesPage';

// Provider Flow Pages
import { ProviderJobsPage } from '../pages/provider/ProviderJobsPage';
import { ProviderJobDetailPage } from '../pages/provider/ProviderJobDetailPage';
import { ProviderSchedulePage } from '../pages/provider/ProviderSchedulePage';
import { ProviderReviewsPage } from '../pages/provider/ProviderReviewsPage';
import { ProviderProfilePage } from '../pages/provider/ProviderProfilePage';

// Admin Flow Pages
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage';
import { AdminVerificationsPage } from '../pages/admin/AdminVerificationsPage';
import { AdminPropertiesPage } from '../pages/admin/AdminPropertiesPage';
import { AdminUsersPage } from '../pages/admin/AdminUsersPage';

/**
 * Main Application Routes tree
 */
export function AppRoutes() {
  return (
    <Routes>
      {/* Public Pages wrapped in PublicLayout */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/spaces/:id" element={<SpaceDetailPage />} />
        {import.meta.env.DEV && <Route path="/design" element={<DesignSystemPage />} />}
        <Route path="/for-owners" element={<Navigate to="/" replace />} />
        <Route
          path="/for-providers"
          element={
            <ComingSoonPage
              phase="Phase F4"
              title="Provider Guild Network"
              description="Information on joining the vetted guild of property restoration and repair specialists."
            />
          }
        />

        {/* Guest-only Auth routes */}
        <Route
          path="/login"
          element={
            <GuestRoute>
              <LoginPage />
            </GuestRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <GuestRoute>
              <SignupPage />
            </GuestRoute>
          }
        />
        <Route
          path="/reset-password"
          element={
            <GuestRoute>
              <ResetPasswordPage />
            </GuestRoute>
          }
        />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {/* 404 Fallback in public layout */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* Authenticated Dashboard / Workspace wrapped in AppLayout */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Customer & General Authenticated Routes */}
        <Route path="/account/profile" element={<ProfilePage />} />
        <Route path="/bookings" element={<MyBookingsPage />} />
        <Route path="/bookings/:id" element={<BookingDetailPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />

        {/* Owner Routes (OWNER, ADMIN) */}
        <Route
          path="/owner"
          element={
            <RoleRoute allowedRoles={['OWNER', 'ADMIN']}>
              <Navigate to="/owner/dashboard" replace />
            </RoleRoute>
          }
        />
        <Route
          path="/owner/dashboard"
          element={
            <RoleRoute allowedRoles={['OWNER', 'ADMIN']}>
              <OwnerDashboardPage />
            </RoleRoute>
          }
        />
        <Route
          path="/owner/properties"
          element={
            <RoleRoute allowedRoles={['OWNER', 'ADMIN']}>
              <OwnerPropertiesPage />
            </RoleRoute>
          }
        />
        <Route
          path="/owner/properties/new"
          element={
            <RoleRoute allowedRoles={['OWNER', 'ADMIN']}>
              <ListPropertyPage />
            </RoleRoute>
          }
        />
        <Route
          path="/owner/properties/:id"
          element={
            <RoleRoute allowedRoles={['OWNER', 'ADMIN']}>
              <OwnerPropertyDetailPage />
            </RoleRoute>
          }
        />
        <Route
          path="/owner/properties/:id/edit"
          element={
            <RoleRoute allowedRoles={['OWNER', 'ADMIN']}>
              <EditPropertyPage />
            </RoleRoute>
          }
        />
        <Route
          path="/owner/properties/:propertyId/spaces/new"
          element={
            <RoleRoute allowedRoles={['OWNER', 'ADMIN']}>
              <AddSpacePage />
            </RoleRoute>
          }
        />
        <Route
          path="/owner/spaces/:id/edit"
          element={
            <RoleRoute allowedRoles={['OWNER', 'ADMIN']}>
              <EditSpacePage />
            </RoleRoute>
          }
        />
        <Route
          path="/owner/bookings"
          element={
            <RoleRoute allowedRoles={['OWNER', 'ADMIN']}>
              <OwnerBookingsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/owner/bookings/:id"
          element={
            <RoleRoute allowedRoles={['OWNER', 'ADMIN']}>
              <OwnerBookingDetailPage />
            </RoleRoute>
          }
        />
        <Route
          path="/owner/maintenance"
          element={
            <RoleRoute allowedRoles={['OWNER', 'ADMIN']}>
              <OwnerMaintenancePage />
            </RoleRoute>
          }
        />
        <Route
          path="/owner/maintenance/:id"
          element={
            <RoleRoute allowedRoles={['OWNER', 'ADMIN']}>
              <OwnerMaintenanceDetailPage />
            </RoleRoute>
          }
        />
        <Route
          path="/owner/expenses"
          element={
            <RoleRoute allowedRoles={['OWNER', 'ADMIN']}>
              <OwnerExpensesPage />
            </RoleRoute>
          }
        />
        <Route
          path="/owner/inspections"
          element={
            <RoleRoute allowedRoles={['OWNER', 'ADMIN']}>
              <OwnerInspectionsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/owner/inspections/:id"
          element={
            <RoleRoute allowedRoles={['OWNER', 'ADMIN']}>
              <OwnerInspectionDetailPage />
            </RoleRoute>
          }
        />

        {/* Provider Routes (PROVIDER, ADMIN) */}
        <Route
          path="/provider"
          element={
            <RoleRoute allowedRoles={['PROVIDER', 'ADMIN']}>
              <Navigate to="/provider/jobs" replace />
            </RoleRoute>
          }
        />
        <Route
          path="/provider/jobs"
          element={
            <RoleRoute allowedRoles={['PROVIDER', 'ADMIN']}>
              <ProviderJobsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/provider/jobs/:id"
          element={
            <RoleRoute allowedRoles={['PROVIDER', 'ADMIN']}>
              <ProviderJobDetailPage />
            </RoleRoute>
          }
        />
        <Route
          path="/provider/schedule"
          element={
            <RoleRoute allowedRoles={['PROVIDER', 'ADMIN']}>
              <ProviderSchedulePage />
            </RoleRoute>
          }
        />
        <Route
          path="/provider/reviews"
          element={
            <RoleRoute allowedRoles={['PROVIDER', 'ADMIN']}>
              <ProviderReviewsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/provider/profile"
          element={
            <RoleRoute allowedRoles={['PROVIDER', 'ADMIN']}>
              <ProviderProfilePage />
            </RoleRoute>
          }
        />

        {/* Admin Routes (ADMIN only) */}
        <Route
          path="/admin"
          element={
            <RoleRoute allowedRoles={['ADMIN']}>
              <AdminDashboardPage />
            </RoleRoute>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <RoleRoute allowedRoles={['ADMIN']}>
              <AdminDashboardPage />
            </RoleRoute>
          }
        />
        <Route
          path="/admin/verifications"
          element={
            <RoleRoute allowedRoles={['ADMIN']}>
              <AdminVerificationsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/admin/properties"
          element={
            <RoleRoute allowedRoles={['ADMIN']}>
              <AdminPropertiesPage />
            </RoleRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RoleRoute allowedRoles={['ADMIN']}>
              <AdminUsersPage />
            </RoleRoute>
          }
        />
      </Route>
    </Routes>
  );
}

export default AppRoutes;
