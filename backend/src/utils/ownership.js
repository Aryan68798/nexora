import { AppError } from './AppError.js';

/**
 * Asserts that the given property belongs to the specified user.
 * Throws 404 NOT_FOUND if the property is missing or owned by another user.
 * @param {{ owner_id?: string, ownerId?: string } | null | undefined} property - The property object
 * @param {string} userId - The authenticated user ID
 * @throws {AppError} 404 NOT_FOUND
 */
export function assertOwnsProperty(property, userId) {
  if (!property) {
    throw AppError.notFound('Property not found');
  }
  const ownerId = property.ownerId ?? property.owner_id;
  if (ownerId !== userId) {
    throw AppError.notFound('Property not found');
  }
}

/**
 * Asserts that the given space belongs to a property owned by the specified user.
 * Throws 404 NOT_FOUND if the space is missing or owned by another user.
 * @param {{ property?: { owner_id?: string, ownerId?: string } | null, properties?: { owner_id?: string, ownerId?: string } | null } | null | undefined} space - The space object
 * @param {string} userId - The authenticated user ID
 * @throws {AppError} 404 NOT_FOUND
 */
export function assertOwnsSpace(space, userId) {
  if (!space) {
    throw AppError.notFound('Space not found');
  }
  const prop = space.property ?? space.properties;
  const ownerId = prop?.ownerId ?? prop?.owner_id;
  if (!ownerId || ownerId !== userId) {
    throw AppError.notFound('Space not found');
  }
}

/**
 * Asserts that the authenticated user has permission to view the specified booking.
 * Admins, the booking customer, and the space property owner are allowed.
 * Throws 404 NOT_FOUND to hide resource existence from unauthorized users.
 * @param {{ customerId?: string, customer_id?: string, space?: { property?: { owner_id?: string, ownerId?: string } | null } | null } | null | undefined} booking - The booking object
 * @param {string} userId - The authenticated user ID
 * @param {string} userRole - The authenticated user role
 * @throws {AppError} 404 NOT_FOUND
 */
export function assertCanViewBooking(booking, userId, userRole) {
  if (!booking) {
    throw AppError.notFound('Booking not found');
  }
  if (userRole === 'ADMIN') {
    return;
  }
  const customerId = booking.customerId ?? booking.customer_id;
  if (customerId === userId) {
    return;
  }
  const ownerId = booking.space?.property?.ownerId ?? booking.space?.property?.owner_id;
  if (ownerId && ownerId === userId) {
    return;
  }
  throw AppError.notFound('Booking not found');
}
