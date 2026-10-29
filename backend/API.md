# Nexora API Documentation (Phase 2A, Phase 2B, Phase 3, Phase 4A, Phase 4B, Phase 4C & Phase 4D)

Base URL: `/api`

All JSON responses follow the standard Nexora envelope format:
- **Success**: `{ "success": true, "data": ..., "meta"?: { ... } }`
- **Error**: `{ "success": false, "error": { "code": string, "message": string, "details"?: any } }`

Every response includes the `X-Request-Id` response header for tracing.

---

## 1. Health Endpoints

### `GET /api/health`
Checks server operational status, uptime, and timestamp.
- **Auth**: Public (no authentication)
- **Rate Limit**: Global (100 req/min)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "uptime": 519.55,
    "timestamp": "2026-11-21T16:18:28.245Z"
  }
}
```

### `GET /api/health/db`
Verifies live PostgreSQL database connectivity via Prisma (`SELECT 1`).
- **Auth**: Public
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "db": "connected"
  }
}
```
- **Error Codes**:
  - `503 SERVICE_UNAVAILABLE`: Database connection failed.

---

## 2. Authentication & Profile Endpoints

### `GET /api/auth/me`
Retrieves the authenticated user's profile and associated `serviceProvider` record (if one exists).
- **Auth**: Required (`Authorization: Bearer <jwt>`)
- **Rate Limit**: Auth routes (60 req/min)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "id": "e44d82fc-93f4-411a-85d1-55ec363c4e36",
    "name": "Alex Mercer",
    "email": "alex@example.com",
    "phone": "+919876543210",
    "role": "CUSTOMER",
    "is_active": true,
    "avatar_url": "https://example.com/avatars/alex.jpg",
    "created_at": "2026-11-21T12:00:00.000Z",
    "updated_at": "2026-11-21T12:00:00.000Z",
    "serviceProvider": null
  }
}
```
- **Error Codes**:
  - `401 UNAUTHORIZED`: Missing or invalid Bearer token.
  - `403 ACCOUNT_DISABLED`: User account `is_active` flag is false.
  - `404 NOT_FOUND`: Profile not found.

### `PATCH /api/auth/me`
Updates user profile fields (`name`, `phone`, `avatarUrl`). Strictly rejects attempts to modify `role` or `isActive`.
- **Auth**: Required (`Authorization: Bearer <jwt>`)
- **Rate Limit**: Auth routes (60 req/min)
- **Request Body**:
```json
{
  "name": "Alex Mercer",
  "phone": "+919876543210",
  "avatarUrl": "https://example.com/avatar.png"
}
```
- **Validation Rules**:
  - `name`: String, 2 to 100 characters (optional)
  - `phone`: E.164-compatible pattern (7-15 digits, optional/nullable)
  - `avatarUrl`: HTTPS URL (optional/nullable)
  - `role`, `is_active`: Disallowed (rejects with 400)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "id": "e44d82fc-93f4-411a-85d1-55ec363c4e36",
    "name": "Alex Mercer",
    "email": "alex@example.com",
    "phone": "+919876543210",
    "role": "CUSTOMER",
    "is_active": true,
    "avatar_url": "https://example.com/avatar.png",
    "created_at": "2026-11-21T12:00:00.000Z",
    "updated_at": "2026-11-21T16:18:28.000Z",
    "serviceProvider": null
  }
}
```
- **Error Codes**:
  - `400 VALIDATION_ERROR`: Field validation failed or unrecognized keys provided.
  - `401 UNAUTHORIZED`: Missing/invalid token.
  - `403 ACCOUNT_DISABLED`: Account disabled.

### `POST /api/auth/me/role`
Transitions an initial `CUSTOMER` user to an `OWNER` or `PROVIDER` role. Permitted strictly when the user has zero recorded bookings, zero payments, and zero favorites. Role `ADMIN` is strictly forbidden.
- **Auth**: Required (`Authorization: Bearer <jwt>`)
- **Rate Limit**: Role change routes (5 req/hour per user)
- **Request Body**:
```json
{
  "role": "OWNER"
}
```
- **Validation Rules**:
  - `role`: Must be either `"OWNER"` or `"PROVIDER"` (Zod strict; any unknown fields or `"ADMIN"` rejected with 400).
- **Response `200 OK`**: Updated profile object with the new role.
- **Error Codes**:
  - `400 VALIDATION_ERROR`: Missing role, invalid role value, or extraneous keys.
  - `401 UNAUTHORIZED`: Missing/invalid token.
  - `403 ACCOUNT_DISABLED`: Account disabled.
  - `409 ROLE_CHANGE_NOT_ALLOWED`: Current role is not `CUSTOMER`, or user has existing bookings, payments, or favorites.

### `POST /api/auth/me/avatar`
Uploads a profile avatar image (JPEG, PNG, or WebP; max 2 MB). Automatically cleans up any previously uploaded avatar object from storage upon replacement.
- **Auth**: Required (`Authorization: Bearer <jwt>`)
- **Rate Limit**: Upload routes (30 req/min)
- **Request Format**: `multipart/form-data`
  - `file`: Image binary (max 2 MB)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "avatarUrl": "https://zohtnfconjrjvxmvpcvj.supabase.co/storage/v1/object/public/Avatars/e44d82fc-93f4-411a-85d1-55ec363c4e36/a5b1c2d3-4e5f.png"
  }
}
```
- **Error Codes**:
  - `400 INVALID_FILE_TYPE`: File is not a valid JPEG, PNG, or WebP, or magic bytes mismatch.
  - `413 FILE_TOO_LARGE`: Image exceeds 2 MB limit.
  - `503 STORAGE_NOT_CONFIGURED`: Supabase storage service credentials missing.

---

## 3. Service Categories Endpoints

### `GET /api/service-categories`
Lists all active service categories, ordered alphabetically by name.
- **Auth**: Public
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "id": "32f49f05-b539-402c-83e3-d4229882a12f",
      "name": "Appliance Repair",
      "description": "Diagnosis and repair of kitchen, laundry, and household appliances.",
      "is_active": true,
      "created_at": "2026-11-21T16:09:12.000Z"
    },
    {
      "id": "6a178bff-d035-4d54-a458-5dbb0b95d9ce",
      "name": "Carpentry",
      "description": "Woodwork, furniture repair, door and window framing, and cabinetry.",
      "is_active": true,
      "created_at": "2026-11-21T16:09:12.000Z"
    }
  ]
}
```

### `POST /api/service-categories`
Creates a new service category.
- **Auth**: Required (`ADMIN` role only)
- **Request Body**:
```json
{
  "name": "Solar Panel Maintenance",
  "description": "Cleaning, electrical testing, and inverter servicing.",
  "isActive": true
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "id": "84813589-9fa9-4448-9bbd-327c65306660",
    "name": "Solar Panel Maintenance",
    "description": "Cleaning, electrical testing, and inverter servicing.",
    "is_active": true,
    "created_at": "2026-11-21T16:20:00.000Z"
  }
}
```
- **Error Codes**:
  - `400 VALIDATION_ERROR`: Missing or invalid fields.
  - `401 UNAUTHORIZED`: Missing/invalid token.
  - `403 FORBIDDEN`: Non-admin access.
  - `409 CONFLICT`: Category with this name already exists.

### `PATCH /api/service-categories/:id`
Updates an existing service category.
- **Auth**: Required (`ADMIN` role only)
- **Request Body**:
```json
{
  "description": "Updated category description.",
  "isActive": false
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "id": "84813589-9fa9-4448-9bbd-327c65306660",
    "name": "Solar Panel Maintenance",
    "description": "Updated category description.",
    "is_active": false,
    "created_at": "2026-11-21T16:20:00.000Z"
  }
}
```
- **Error Codes**:
  - `400 VALIDATION_ERROR`: Invalid format.
  - `403 FORBIDDEN`: Non-admin access.
  - `404 NOT_FOUND`: Category ID does not exist.

---

## 4. Admin Management Endpoints

### `GET /api/admin/users`
Lists user profiles with pagination and multi-field filtering.
- **Auth**: Required (`ADMIN` role only)
- **Query Parameters**:
  - `page`: Integer (default: 1)
  - `pageSize`: Integer (default: 20, max: 100)
  - `role`: Filter by role (`OWNER` | `CUSTOMER` | `PROVIDER` | `ADMIN`)
  - `isActive`: Boolean (`true` | `false`)
  - `search`: String (case-insensitive substring search across name and email)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "id": "e44d82fc-93f4-411a-85d1-55ec363c4e36",
      "name": "Test User",
      "email": "test@example.com",
      "phone": null,
      "role": "CUSTOMER",
      "is_active": true,
      "avatar_url": null,
      "created_at": "2026-11-21T15:00:00.000Z",
      "updated_at": "2026-11-21T15:00:00.000Z",
      "service_providers": null
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  }
}
```
- **Error Codes**:
  - `401 UNAUTHORIZED`: Authentication required.
  - `403 FORBIDDEN`: Non-admin access.

### `PATCH /api/admin/users/:id`
Updates a user profile's role or activation state. Admins cannot demote their own role or deactivate their own account.
- **Auth**: Required (`ADMIN` role only)
- **Request Body**:
```json
{
  "role": "PROVIDER",
  "isActive": true
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "id": "e44d82fc-93f4-411a-85d1-55ec363c4e36",
    "name": "Test User",
    "email": "test@example.com",
    "role": "PROVIDER",
    "is_active": true,
    "created_at": "2026-11-21T15:00:00.000Z",
    "updated_at": "2026-11-21T16:22:00.000Z"
  }
}
```
- **Error Codes**:
  - `400 BAD_REQUEST`: Attempting to demote or deactivate the calling admin.
  - `403 FORBIDDEN`: Non-admin access.
  - `404 NOT_FOUND`: Target user ID does not exist.

### `GET /api/admin/stats`
Returns system-wide aggregation counts (counts only, zero PII).
- **Auth**: Required (`ADMIN` role only)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "usersByRole": {
      "CUSTOMER": 1,
      "OWNER": 0,
      "PROVIDER": 0,
      "ADMIN": 1
    },
    "propertiesByStatus": {
      "ACTIVE": 0,
      "INACTIVE": 0,
      "UNDER_MAINTENANCE": 0
    },
    "bookingsByStatus": {
      "PENDING": 0,
      "CONFIRMED": 0,
      "COMPLETED": 0,
      "CANCELLED": 0,
      "REJECTED": 0
    }
  }
}
```
- **Error Codes**:
  - `401 UNAUTHORIZED`: Authentication required.
  - `403 FORBIDDEN`: Non-admin access.

---

## 5. Property Management Endpoints

### `POST /api/properties`
Creates a new property owned by the authenticated caller.
- **Auth**: Required (`OWNER` or `ADMIN` role)
- **Request Body**:
```json
{
  "title": "Horizon Tech Center",
  "description": "Premier workspace in Koramangala",
  "propertyType": "COMMERCIAL",
  "addressLine1": "80 Feet Road, 4th Block",
  "addressLine2": "Wing B",
  "city": "Bengaluru",
  "state": "Karnataka",
  "postalCode": "560034",
  "country": "India",
  "latitude": 12.935242,
  "longitude": 77.624461
}
```
- **Validation Rules**:
  - `title`: String (3 to 150 chars, required)
  - `propertyType`: String enum (`APARTMENT`, `HOUSE`, `VILLA`, `COMMERCIAL`, `OFFICE_BUILDING`, `HOSTEL`, `WAREHOUSE`, `OTHER`, required)
  - `addressLine1`: String (3 to 200 chars, required)
  - `city`: String (2 to 100 chars, required)
  - `state`: String (2 to 100 chars, required)
  - `postalCode`: String (4 to 10 chars, required)
  - `country`: String (default `"India"`)
  - `latitude`: Number (-90 to 90, optional)
  - `longitude`: Number (-180 to 180, optional)
  - `ownerId`: Disallowed in request body (always sourced from `req.user.id`)
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "ownerId": "e44d82fc-93f4-411a-85d1-55ec363c4e36",
    "title": "Horizon Tech Center",
    "description": "Premier workspace in Koramangala",
    "propertyType": "COMMERCIAL",
    "status": "ACTIVE",
    "addressLine1": "80 Feet Road, 4th Block",
    "city": "Bengaluru",
    "state": "Karnataka",
    "postalCode": "560034",
    "country": "India",
    "createdAt": "2026-11-22T01:30:00.000Z",
    "updatedAt": "2026-11-22T01:30:00.000Z"
  }
}
```
- **Error Codes**:
  - `400 VALIDATION_ERROR`: Field validation failed or unrecognized keys present.
  - `401 UNAUTHORIZED`: Authentication required.
  - `403 FORBIDDEN`: Non-owner/admin caller.

### `GET /api/properties/mine`
Retrieves properties owned by the authenticated caller with space counts and cover image URLs.
- **Auth**: Required (`OWNER` role)
- **Query Parameters**:
  - `page`: Integer (default 1)
  - `pageSize`: Integer (default 20, max 100)
  - `status`: String enum (`ACTIVE`, `INACTIVE`, `UNDER_MAINTENANCE`)
  - `search`: Case-insensitive search on title or city
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
      "title": "Horizon Tech Center",
      "propertyType": "COMMERCIAL",
      "status": "ACTIVE",
      "city": "Bengaluru",
      "state": "Karnataka",
      "spaceCount": 3,
      "coverImageUrl": "https://.../property-media/cover.png",
      "createdAt": "2026-11-22T01:30:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

### `GET /api/properties`
Administrative listing of all properties across the system with filtering.
- **Auth**: Required (`ADMIN` role)
- **Query Parameters**: `page`, `pageSize`, `status`, `city`, `state`, `search`
- **Response `200 OK`**: Paginated array of properties including owner summaries.

### `GET /api/properties/:id`
Retrieves property details. `ACTIVE` properties are publicly accessible; non-active properties return `404 NOT_FOUND` to everyone except the owner and administrators.
- **Auth**: Public (`optionalAuth`)
- **Sanitization**: Returns owner first/last name only; never exposes owner email or phone number.
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "title": "Horizon Tech Center",
    "propertyType": "COMMERCIAL",
    "status": "ACTIVE",
    "addressLine1": "80 Feet Road, 4th Block",
    "city": "Bengaluru",
    "state": "Karnataka",
    "postalCode": "560034",
    "owner": {
      "id": "e44d82fc-93f4-411a-85d1-55ec363c4e36",
      "name": "Alex Mercer"
    },
    "media": [],
    "spaces": []
  }
}
```
- **Error Codes**:
  - `404 NOT_FOUND`: Property not found or inactive for unauthorized callers.

### `PATCH /api/properties/:id`
Updates property metadata or status. Ownership is strictly enforced.
- **Auth**: Required (Property Owner or `ADMIN`)
- **Request Body**: Partial property fields (`title`, `description`, `propertyType`, `status`, address fields). `ownerId` changes are rejected.
- **Response `200 OK`**: Updated property object.
- **Error Codes**:
  - `404 NOT_FOUND`: Property not found or caller does not own it.

### `DELETE /api/properties/:id`
Soft-deletes a property by transitioning its status to `INACTIVE` and all child spaces to `UNAVAILABLE` in a single transaction. (Hard deletion is prohibited to preserve booking integrity).
- **Auth**: Required (Property Owner or `ADMIN`)
- **Response `200 OK`**: Updated property with status `INACTIVE`.

---

## 6. Space Management Endpoints

### `POST /api/properties/:propertyId/spaces`
Creates a rentable space under an owned property.
- **Auth**: Required (Property Owner or `ADMIN`)
- **Request Body**:
```json
{
  "name": "Quantum Boardroom",
  "description": "Executive boardroom with 4K video conferencing",
  "spaceType": "OFFICE",
  "capacity": 16,
  "priceAmount": "1200.00",
  "priceUnit": "HOUR",
  "rules": "No outside catering inside boardroom.",
  "status": "AVAILABLE"
}
```
- **Validation Rules**:
  - `name`: String (2 to 150 chars, required)
  - `spaceType`: String enum (`ROOM`, `OFFICE`, `SHOP`, `STUDIO`, `CLASSROOM`, `PARKING`, `OTHER`, required)
  - `capacity`: Integer (1 to 100000, required)
  - `priceAmount`: Safe Decimal string/number (> 0, max 2 decimal places, max 10000000, required)
  - `priceUnit`: String enum (`HOUR`, `DAY`, required)
  - `status`: String enum (`AVAILABLE`, `UNAVAILABLE`, `MAINTENANCE`, default `AVAILABLE`)
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "id": "7c2deb4d-3b7d-4bad-9bdd-2b0d7b3dcb7e",
    "propertyId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "name": "Quantum Boardroom",
    "spaceType": "OFFICE",
    "capacity": 16,
    "priceAmount": "1200.00",
    "priceUnit": "HOUR",
    "status": "AVAILABLE"
  }
}
```

### `GET /api/properties/:propertyId/spaces`
Lists spaces within a property. Owners and Admins view all space statuses; public callers receive only `AVAILABLE` spaces belonging to `ACTIVE` properties.
- **Auth**: Public (`optionalAuth`)
- **Response `200 OK`**: Array of spaces with pricing and cover media.

### `PATCH /api/spaces/:id`
Partially updates a space. Modifying pricing has zero impact on historic bookings.
- **Auth**: Required (Space Owner or `ADMIN`)
- **Request Body**: Partial space fields (`name`, `description`, `spaceType`, `capacity`, `priceAmount`, `priceUnit`, `rules`, `status`).
- **Response `200 OK`**: Updated space object.

### `DELETE /api/spaces/:id`
Soft-deletes a space by setting status to `UNAVAILABLE`.
- **Auth**: Required (Space Owner or `ADMIN`)
- **Response `200 OK`**: Updated space object with status `UNAVAILABLE`.

---

## 7. Public Search, Space Details & Reviews

### `GET /api/spaces`
Public search and catalog exploration endpoint. Strictly returns only `AVAILABLE` spaces within `ACTIVE` properties.
- **Auth**: Public (`optionalAuth`)
- **Query Parameters**:
  - `q`: Search string (matches space name, description, property title, city)
  - `city`, `state`: Geographic filters
  - `spaceType`: Comma-separated or single space types (`ROOM`, `OFFICE`, etc.)
  - `priceUnit`: `HOUR` or `DAY`
  - `minPrice`, `maxPrice`: Numeric price range filters
  - `minCapacity`: Minimum required capacity
  - `sort`: `newest` (default), `price_asc`, `price_desc`, `rating`
  - `page`, `pageSize`: Pagination parameters
- **Performance**: Review counts and average ratings are computed via a single efficient `groupBy` aggregation (no N+1 queries). Logged-in callers receive an `isFavorite` boolean indicator.
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "id": "7c2deb4d-3b7d-4bad-9bdd-2b0d7b3dcb7e",
      "name": "Quantum Boardroom",
      "spaceType": "OFFICE",
      "capacity": 16,
      "priceAmount": "1200.00",
      "priceUnit": "HOUR",
      "property": {
        "id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
        "title": "Horizon Tech Center",
        "city": "Bengaluru",
        "state": "Karnataka"
      },
      "coverImageUrl": "https://.../space-media/cover.png",
      "averageRating": 4.8,
      "reviewCount": 14,
      "isFavorite": false
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

### `GET /api/spaces/:id`
Full space detail view with property summary, ordered media gallery, reviews aggregation, and favorite status.
- **Auth**: Public (`optionalAuth`)
- **Visibility**: Non-available spaces or spaces in inactive properties return `404 NOT_FOUND` unless requested by the space owner or an admin.
- **Response `200 OK`**: Space object with `media` array ordered by `sortOrder`, `property` (with owner name only, no email/phone), `averageRating`, `reviewCount`, and `isFavorite`.

### `GET /api/spaces/:id/reviews`
Publicly lists space reviews.
- **Auth**: Public
- **Query Parameters**: `page`, `pageSize`
- **Privacy Rule**: Reviewer author object includes only the first name (`firstName`); never exposes full name, email, or contact details.
- **Response `200 OK`**: Paginated array of reviews with rating, comment, createdAt, and author first name.

### `GET /api/catalog/filters`
Provides dynamic faceted filter parameters for the frontend search UI.
- **Auth**: Public
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "cities": ["Bengaluru", "Mumbai", "New Delhi"],
    "spaceTypes": ["ROOM", "OFFICE", "SHOP", "STUDIO", "CLASSROOM", "PARKING", "OTHER"],
    "priceRange": {
      "min": "500.00",
      "max": "6000.00"
    }
  }
}
```

---

## 8. Customer Favorites Endpoints

### `GET /api/favorites`
Lists the authenticated customer's favorited spaces, sorted by newest favorite first.
- **Auth**: Required (`CUSTOMER` role)
- **Query Parameters**: `page`, `pageSize`
- **Response `200 OK`**: Paginated list of spaces adhering to the standard catalog space item shape (`isFavorite: true`).

### `PUT /api/favorites/:spaceId`
Idempotently adds a space to the customer's favorites.
- **Auth**: Required (`CUSTOMER` role)
- **Validation**: Returns `404 NOT_FOUND` if the space does not exist or is not publicly available (`AVAILABLE` in an `ACTIVE` property).
- **Response `200 OK` / `201 Created`**:
```json
{
  "success": true,
  "data": {
    "spaceId": "7c2deb4d-3b7d-4bad-9bdd-2b0d7b3dcb7e",
    "isFavorite": true
  }
}
```

### `DELETE /api/favorites/:spaceId`
Idempotently removes a space from the customer's favorites.
- **Auth**: Required (`CUSTOMER` role)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "spaceId": "7c2deb4d-3b7d-4bad-9bdd-2b0d7b3dcb7e",
    "isFavorite": false
  }
}
```

---

## 9. Media & Storage Management Endpoints

Media rules:
- **Formats Allowed**: JPEG (`image/jpeg`), PNG (`image/png`), WebP (`image/webp`).
- **Rejected Formats**: SVG and unverified MIME types are strictly rejected via magic byte inspection.
- **Storage Limits**: Maximum 5 MB per media file; 10 images max per property or space.
- **Rate Limit**: 30 upload requests per minute per IP.
- **Storage Path Schema**: `<ownerId>/<uuid>.<ext>` (client file names are never used in storage paths).
- **Atomicity**: If the database transaction fails, uploaded storage objects are automatically removed to prevent orphan files.

### `POST /api/properties/:id/media`
Uploads an image for a property to the `property-media` bucket.
- **Auth**: Required (Property Owner or `ADMIN`)
- **Request Format**: `multipart/form-data`
  - `file`: Image binary (max 5 MB)
  - `caption`: Optional string (max 200 chars)
- **Behavior**: The first uploaded image is automatically marked as `isCover = true`. Subsequent images are appended with incrementing `sortOrder`.
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "id": "4d1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb8f",
    "propertyId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "url": "https://zohtnfconjrjvxmvpcvj.supabase.co/storage/v1/object/public/property-media/owner-id/uuid.png",
    "caption": "Main entrance",
    "sortOrder": 0,
    "isCover": true,
    "createdAt": "2026-11-22T01:30:00.000Z"
  }
}
```
- **Error Codes**:
  - `400 INVALID_FILE_TYPE`: Invalid or spoofed image.
  - `409 CONFLICT`: Property already has 10 images (`MAX_MEDIA_REACHED`).
  - `413 FILE_TOO_LARGE`: Image exceeds 5 MB.

### `POST /api/spaces/:id/media`
Uploads an image for a space to the `space-media` bucket.
- **Auth**: Required (Space Owner or `ADMIN`)
- **Request Format**: `multipart/form-data` (`file`, optional `caption`)
- **Response `201 Created`**: Space media object.

### `DELETE /api/property-media/:id`
Deletes a property media item. Deletes the physical file from Supabase storage and its corresponding rows in `property_media` and `media_assets`.
- **Auth**: Required (Property Owner or `ADMIN`)
- **Cover Promotion**: If the deleted media was the cover image, the next available image sorted by `sortOrder` is automatically promoted to cover.
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "id": "4d1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb8f",
    "deleted": true
  }
}
```

### `PATCH /api/property-media/:id`
Updates caption, sort order, or cover status. Setting `isCover = true` atomically demotes all other images for the property, ensuring exactly one cover image.
- **Auth**: Required (Property Owner or `ADMIN`)
- **Request Body**: `caption` (optional), `sortOrder` (optional integer), `isCover` (optional boolean).
- **Response `200 OK`**: Updated media item.

### `DELETE /api/space-media/:id`
Deletes a space media item from storage and database with cover promotion.
- **Auth**: Required (Space Owner or `ADMIN`)
- **Response `200 OK`**: `{ "success": true, "data": { "id": "...", "deleted": true } }`.

### `PATCH /api/space-media/:id`
Updates space media caption, sort order, or cover status with single-cover guarantee.
- **Auth**: Required (Space Owner or `ADMIN`)
- **Response `200 OK`**: Updated space media item.

---

## 10. Pricing Formula, Rules & Invariants

Pricing calculations are strictly deterministic and implemented in `services/pricing.service.js` using `Prisma.Decimal` with `ROUND_HALF_UP` to 2 decimal places. Floating-point mathematics is strictly prohibited.

### 10.1 Formula
- **Unit Duration**:
  - `HOUR`: $\text{units} = \max(1, \lceil\text{durationMinutes} / 60\rceil)$
  - `DAY`: $\text{units} = \max(1, \lceil\text{durationHours} / 24\rceil)$
- **Financial Breakdown**:
  - $\text{subtotal} = \text{priceAmount} \times \text{units}$
  - $\text{taxAmount} = \text{subtotal} \times \text{TAX\_PERCENT} / 100$ (default $18\%$)
  - $\text{totalAmount} = \text{subtotal} + \text{taxAmount}$
  - $\text{platformFee} = \text{subtotal} \times \text{PLATFORM\_FEE\_PERCENT} / 100$ (default $10\%$)
  - $\text{ownerAmount} = \text{subtotal} - \text{platformFee}$

### 10.2 Invariants Enforced
1. $\text{totalAmount} = \text{subtotal} + \text{taxAmount}$
2. $\text{ownerAmount} + \text{platformFee} = \text{subtotal}$
3. $\text{subtotal} \ge 0, \text{taxAmount} \ge 0, \text{totalAmount} \ge 0, \text{platformFee} \ge 0, \text{ownerAmount} \ge 0$

---

## 11. Booking Lifecycle & Endpoints

### State Machine Transition Matrix
| Current Status | Target Status | Permitted Actors | Conditions & Invariants |
| :--- | :--- | :--- | :--- |
| `PENDING` | `CONFIRMED` | Space Owner, `ADMIN` | Re-verifies no overlap with existing `CONFIRMED` bookings |
| `PENDING` | `REJECTED` | Space Owner, `ADMIN` | Full refund of any pre-captured payments |
| `PENDING` | `CANCELLED` | Customer, Space Owner, `ADMIN` | Full refund of any pre-captured payments |
| `CONFIRMED` | `CANCELLED` | Customer | Permitted only *before* `startAt`. Full refund if cancelled $\ge 24\text{h}$ before `startAt` (`FREE_CANCELLATION_HOURS`); zero refund if cancelled late |
| `CONFIRMED` | `CANCELLED` | Space Owner, `ADMIN` | Full refund of all `PAID` payments |
| `CONFIRMED` | `COMPLETED` | Space Owner, `ADMIN` | Allowed only *after* scheduled `endAt` has passed |
| `CANCELLED`, `REJECTED`, `COMPLETED` | *None* | *None* | Terminal statuses cannot transition |

### Refund Policy
- **Full Refund**: Booking rejected; or cancelled by Owner/Admin; or cancelled by Customer at least `FREE_CANCELLATION_HOURS` (24h) before booking `startAt`. All `PAID` payments updated to `REFUNDED`.
- **No Refund**: Customer cancels inside the `FREE_CANCELLATION_HOURS` window (late cancellation). Payments retain `PAID` status.

---

### `POST /api/bookings/quote`
Calculates an authoritative pricing quote without persisting data or reserving the slot.
- **Auth**: Required (`CUSTOMER` role)
- **Request Body**:
```json
{
  "spaceId": "9c41d211-9743-43af-bc6c-0e7a845fe187",
  "startAt": "2026-12-01T10:00:00+05:30",
  "endAt": "2026-12-01T12:00:00+05:30",
  "guestCount": 4
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "pricing": {
      "units": 2,
      "unitLabel": "hours",
      "subtotal": "1000.00",
      "taxAmount": "180.00",
      "totalAmount": "1180.00",
      "platformFee": "100.00",
      "ownerAmount": "900.00"
    },
    "isAvailable": true,
    "space": {
      "id": "9c41d211-9743-43af-bc6c-0e7a845fe187",
      "name": "Executive Conference Room",
      "spaceType": "OFFICE",
      "capacity": 12
    }
  }
}
```

### `POST /api/bookings`
Creates a new booking in `PENDING` status. Locks space row with `SELECT ... FOR UPDATE` to prevent concurrency collisions.
- **Auth**: Required (`CUSTOMER` role)
- **Rate Limit**: 10 requests per minute per user
- **Request Body**: Same as quote.
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "id": "2f7b9094-38cb-4e9a-82cd-a2664f23ab51",
    "spaceId": "9c41d211-9743-43af-bc6c-0e7a845fe187",
    "customerId": "c0000000-0000-4000-a000-000000000001",
    "startAt": "2026-12-01T10:00:00.000Z",
    "endAt": "2026-12-01T12:00:00.000Z",
    "guestCount": 4,
    "status": "PENDING",
    "subtotal": "1000.00",
    "platformFee": "100.00",
    "taxAmount": "180.00",
    "totalAmount": "1180.00",
    "ownerAmount": "900.00",
    "paidAmount": "0.00",
    "createdAt": "2026-11-22T14:00:00.000Z"
  }
}
```
- **Error Codes**:
  - `400 LEAD_TIME_VIOLATION`: Must book at least 30 minutes in advance.
  - `400 CAPACITY_EXCEEDED`: `guestCount` exceeds space capacity.
  - `400 OWN_PROPERTY`: Customer owns the property.
  - `403 FORBIDDEN`: Non-customer caller.
  - `404 NOT_FOUND`: Space not found, inactive property, or unavailable.
  - `409 SLOT_UNAVAILABLE`: Overlapping `PENDING` or `CONFIRMED` booking.

### `GET /api/bookings/mine`
Lists the authenticated customer's bookings.
- **Auth**: Required (`CUSTOMER` role)
- **Query Parameters**: `page`, `pageSize`, `status`, `from`, `to`
- **Response `200 OK`**: Paginated array of customer bookings with space metadata, cover images, price breakdown, and paid balance.

### `GET /api/owner/bookings`
Lists bookings across all spaces owned by the authenticated owner.
- **Auth**: Required (`OWNER` role)
- **Query Parameters**: `page`, `pageSize`, `status`, `propertyId`, `spaceId`, `from`, `to`
- **Sanitization Rule**: Exposes customer's display name and phone number ONLY (strictly suppresses email).
- **Response `200 OK`**: Paginated array of owner bookings.

### `GET /api/bookings`
Administrative listing of all bookings across the platform.
- **Auth**: Required (`ADMIN` role)
- **Query Parameters**: `page`, `pageSize`, `status`, `propertyId`, `spaceId`, `from`, `to`
- **Response `200 OK`**: Paginated array of bookings with complete profile information.

### `GET /api/bookings/:id`
Full booking details, status history, payment receipts, and permissible next actions.
- **Auth**: Required (Customer, Space Owner, or `ADMIN`)
- **Access Control**: Unrelated users receive `404 NOT_FOUND`.
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "id": "2f7b9094-38cb-4e9a-82cd-a2664f23ab51",
    "status": "CONFIRMED",
    "totalAmount": "1180.00",
    "paidAmount": "500.00",
    "customer": {
      "id": "c0000000-0000-4000-a000-000000000001",
      "name": "Customer User",
      "phone": "+919876543210"
    },
    "payments": [],
    "statusHistory": [
      {
        "id": "h1",
        "fromStatus": null,
        "status": "PENDING",
        "changedBy": "Customer User",
        "note": "Booking requested by customer",
        "changedAt": "2026-11-22T14:00:00.000Z"
      }
    ],
    "allowedNextActions": ["cancel", "pay"]
  }
}
```

### `PATCH /api/bookings/:id/status`
Transitions a booking according to the state machine matrix.
- **Auth**: Required (Customer, Space Owner, or `ADMIN`)
- **Request Body**:
```json
{
  "status": "CONFIRMED",
  "reason": "Approved"
}
```
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "booking": { "id": "...", "status": "CONFIRMED" },
    "refundedAmount": "0.00"
  }
}
```
- **Error Codes**:
  - `403 FORBIDDEN`: Actor not permitted for requested transition.
  - `409 INVALID_TRANSITION`: Disallowed state change.
  - `409 BOOKING_NOT_ENDED`: Attempting completion before `endAt`.
  - `409 SLOT_UNAVAILABLE`: Overlap detected during confirmation.

### `GET /api/spaces/:id/availability`
Publicly returns blocked intervals for a space without any customer identifiable information.
- **Auth**: Public (`optionalAuth`)
- **Query Parameters**:
  - `from`: ISO 8601 datetime (required)
  - `to`: ISO 8601 datetime (required, max 62 days from `from`)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "startAt": "2026-12-01T10:00:00.000Z",
      "endAt": "2026-12-01T12:00:00.000Z"
    }
  ]
}
```

---

## 12. Simulated Payment Endpoints

> **Note**: Uses a mock gateway for local/sandbox testing. In production, this service interfaces directly with Razorpay or Stripe. Credit card credentials are never requested or stored.

### `POST /api/bookings/:id/payments`
Captures payment for a `CONFIRMED` booking.
- **Auth**: Required (Booking's Customer only)
- **Request Body**:
```json
{
  "method": "UPI",
  "amount": 500.00
}
```
*(If `amount` is omitted, defaults to the exact remaining unpaid balance).*
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "id": "p1",
    "bookingId": "2f7b9094-38cb-4e9a-82cd-a2664f23ab51",
    "amount": "500.00",
    "currency": "INR",
    "paymentMethod": "UPI",
    "status": "PAID",
    "transactionReference": "SIM-bfa0de57-770d-47a3-84cb-85c87f9898e7",
    "paidAt": "2026-11-22T14:15:00.000Z"
  }
}
```
- **Error Codes**:
  - `400 OVERPAYMENT`: Amount exceeds remaining balance.
  - `400 INVALID_AMOUNT`: Amount $\le 0$ or has $> 2$ decimal places.
  - `409 BOOKING_NOT_CONFIRMED`: Cannot pay for unconfirmed booking.

### `GET /api/bookings/:id/payments`
Lists payment transaction receipts for a booking.
- **Auth**: Required (Customer, Space Owner, or `ADMIN`)
- **Response `200 OK`**: Array of payment objects.

---

## 13. Space Review Endpoints

### `POST /api/bookings/:id/review`
Submits a rating and optional review comment for a `COMPLETED` booking. One review allowed per booking.
- **Auth**: Required (Booking's Customer only)
- **Request Body**:
```json
{
  "rating": 5,
  "comment": "Exceptional space with fantastic audio equipment and reliable fiber WiFi."
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "id": "r1",
    "bookingId": "2f7b9094-38cb-4e9a-82cd-a2664f23ab51",
    "spaceId": "9c41d211-9743-43af-bc6c-0e7a845fe187",
    "rating": 5,
    "comment": "Exceptional space with fantastic audio equipment and reliable fiber WiFi.",
    "authorName": "Alex",
    "createdAt": "2026-11-22T14:30:00.000Z"
  }
}
```
- **Error Codes**:
  - `409 BOOKING_NOT_COMPLETED`: Booking has not reached `COMPLETED` status.
  - `409 ALREADY_REVIEWED`: Duplicate review submission.

---

## 14. In-App Notification Endpoints

Notifications are automatically dispatched upon lifecycle events (`BOOKING_REQUESTED`, `BOOKING_CONFIRMED`, `BOOKING_REJECTED`, `BOOKING_CANCELLED`, `BOOKING_COMPLETED`, `PAYMENT_RECEIVED`, `PAYMENT_REFUNDED`, `REVIEW_RECEIVED`). Notifications are non-blocking: failing to create a notification never fails the parent transaction.

### `GET /api/notifications`
Lists notifications for the authenticated user.
- **Auth**: Required
- **Query Parameters**: `page`, `pageSize`, `unread=true`
- **Response `200 OK`**: Paginated array of notifications.

### `GET /api/notifications/unread-count`
Returns the count of unread notifications.
- **Auth**: Required
- **Response `200 OK`**: `{ "success": true, "data": { "count": 3 } }`

### `PATCH /api/notifications/:id/read`
Marks a single notification as read (`readAt = now()`).
- **Auth**: Required (Notification owner only; others receive `404`)
- **Response `200 OK`**: Updated notification.

### `POST /api/notifications/read-all`
Marks all unread notifications for the user as read.
- **Auth**: Required
- **Response `200 OK`**: `{ "success": true, "data": { "count": 3 } }`

---

## 15. Inspection & Checklist Endpoints (Phase 4A)

### Health Score Calculation Specification
Inspection health condition scores are calculated strictly deterministically on the server using `Prisma.Decimal` with `ROUND_HALF_UP` to 2 decimal places:
- **Condition Points**:
  - `EXCELLENT`: 100
  - `GOOD`: 80
  - `FAIR`: 60
  - `POOR`: 30
  - `CRITICAL`: 0
- **Overall Score**: Equal-weight average of all item condition points (`sum(points) / count(items)`). If no items exist, overall score is `null`.
- **Category Score**: Average of condition points for items within the specific category.
- **Grade Thresholds**:
  - `90.00+`: **A**
  - `75.00 - 89.99`: **B**
  - `60.00 - 74.99`: **C**
  - `40.00 - 59.99`: **D**
  - `< 40.00`: **F**
- **Trend Calculation**:
  - `UP`: Latest completed inspection score > previous completed inspection score
  - `DOWN`: Latest completed inspection score < previous completed inspection score
  - `SAME`: Latest completed inspection score == previous completed inspection score
  - `null`: Fewer than two completed inspections recorded for the property.

---

### `POST /api/properties/:propertyId/inspections`
Creates a scheduled inspection for a property.
- **Auth**: Required (`OWNER` of property or `ADMIN`)
- **Request Body**:
```json
{
  "scheduledAt": "2026-12-15T10:00:00+05:30",
  "inspectorId": "44444444-4444-4444-8444-444444444444",
  "summary": "Quarterly physical health audit"
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "id": "f86e5f0d-7229-43ec-b2b1-278014ed920c",
    "propertyId": "732af6d7-5118-45a6-9703-043d47e0eb76",
    "inspectorId": "44444444-4444-4444-8444-444444444444",
    "status": "SCHEDULED",
    "scheduledAt": "2026-12-15T04:30:00.000Z",
    "summary": "Quarterly physical health audit",
    "createdAt": "2026-11-22T11:34:00.000Z"
  }
}
```

---

### `GET /api/properties/:propertyId/inspections`
Retrieves paginated inspections for a property.
- **Auth**: Required (`OWNER` of property or `ADMIN`)
- **Query Parameters**: `page`, `limit`, `status`, `from`, `to`
- **Response `200 OK`**: Array of inspection summaries with score and grade (when completed) and inspector name.

---

### `GET /api/inspections/templates`
Retrieves the standard static checklist template (21 items across Structure, Plumbing, Electrical, Safety, HVAC, Interiors, Exterior, Cleanliness) for UI pre-filling.
- **Auth**: Required (`OWNER`, `PROVIDER`, or `ADMIN`)
- **Response `200 OK`**: Array of `{ category, itemName }`.

---

### `GET /api/inspections/:id`
Retrieves detailed inspection information, items grouped by category, media with temporary signed URLs, and computed score breakdown.
- **Auth**: Required (Property `OWNER`, assigned inspector `PROVIDER`, or `ADMIN`; others receive `404`)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "id": "f86e5f0d-7229-43ec-b2b1-278014ed920c",
    "propertyId": "732af6d7-5118-45a6-9703-043d47e0eb76",
    "status": "COMPLETED",
    "overallConditionScore": "54.00",
    "grade": "D",
    "itemsByCategory": {
      "Structure": [...]
    },
    "media": [
      {
        "id": "m1",
        "url": "https://supabase.co/storage/v1/object/sign/inspection-media/...?token=...",
        "mediaType": "image/png",
        "caption": "Photo description"
      }
    ],
    "score": {
      "overallScore": "54.00",
      "grade": "D",
      "categories": [...],
      "worstItems": [...]
    }
  }
}
```

---

### `PATCH /api/inspections/:id`
Updates scheduled date or summary while inspection is in `SCHEDULED` status.
- **Auth**: Required (Owner or `ADMIN` can update schedule and summary; assigned inspector can update summary only)
- **Response `200 OK`**: Updated inspection record.

---

### `PUT /api/inspections/:id/items`
Replaces the entire evaluation checklist in ONE transaction. Sets `checked_at` to now and advances a `SCHEDULED` inspection to `IN_PROGRESS`.
- **Auth**: Required (Owner, assigned inspector, or `ADMIN`; only while `SCHEDULED` or `IN_PROGRESS`)
- **Request Body**:
```json
{
  "items": [
    { "itemName": "Foundation", "category": "Structure", "condition": "EXCELLENT", "notes": "No cracks" },
    { "itemName": "Drainage", "category": "Plumbing", "condition": "POOR", "notes": "Slow leak" }
  ]
}
```
- **Response `200 OK`**: Updated checklist items and inspection status.

---

### `POST /api/inspections/:id/complete`
Finalizes an inspection in ONE transaction with row locking (`FOR UPDATE`). Server computes the deterministic health score. Requires at least 1 evaluated item.
- **Auth**: Required (Owner, assigned inspector, or `ADMIN`)
- **Request Body**: Strictly empty `{}` (score is computed on the server; bodies containing score or other fields are rejected with `400 VALIDATION_ERROR`).
- **Response `200 OK`**: Completed inspection record with `overallConditionScore`, `grade`, and score breakdown.

---

### `POST /api/inspections/:id/cancel`
Cancels an inspection before completion.
- **Auth**: Required (Property `OWNER` or `ADMIN`; inspectors receive `403 FORBIDDEN`)
- **Response `200 OK`**: Inspection record with status `CANCELLED`.

---

### `POST /api/inspections/:id/media`
Uploads inspection photographic evidence to the private `inspection-media` bucket.
- **Auth**: Required (Owner, assigned inspector, or `ADMIN`; disallowed when `COMPLETED` or `CANCELLED`)
- **Request**: Multipart form data with `file` (JPEG, PNG, WebP up to 5MB, magic-byte verified) and optional `caption`. Maximum 20 media assets per inspection.
- **Response `201 Created`**: Returns temporary signed URL (valid 3600s).

---

### `DELETE /api/inspection-media/:id`
Deletes an inspection media asset from private storage and database records.
- **Auth**: Required (Owner, assigned inspector, or `ADMIN`; disallowed when inspection is `COMPLETED` or `CANCELLED`)
- **Response `200 OK`**: `{ "success": true, "data": { "message": "Inspection media deleted" } }`

---

## 16. Property Health & Overview Endpoints (Phase 4A)

### `GET /api/properties/:propertyId/health`
Retrieves property condition metrics, category breakdown, worst items, trend, next scheduled inspection, and historical scores (up to 6) for charting.
- **Auth**: Required (Property `OWNER` or `ADMIN`; others receive `404`)
- **Response `200 OK`** (with completed inspections):
```json
{
  "success": true,
  "data": {
    "hasData": true,
    "score": "84.50",
    "grade": "B",
    "categoryBreakdown": [
      { "category": "Structure", "score": "90.00", "itemCount": 2 },
      { "category": "Plumbing", "score": "75.00", "itemCount": 3 }
    ],
    "worstItems": [
      { "id": "item-1", "itemName": "Balcony Railing", "category": "Exterior", "condition": "POOR", "notes": "Rusting" }
    ],
    "inspectedAt": "2026-11-22T10:00:00.000Z",
    "previousScore": "80.00",
    "trend": "UP",
    "nextScheduledDate": "2026-12-20T10:00:00.000Z",
    "history": [
      { "id": "insp-1", "score": "80.00", "grade": "B", "inspectedAt": "2026-10-15T10:00:00.000Z" },
      { "id": "insp-2", "score": "84.50", "grade": "B", "inspectedAt": "2026-11-22T10:00:00.000Z" }
    ]
  }
}
```
- **Response `200 OK`** (no completed inspections):
```json
{
  "success": true,
  "data": {
    "hasData": false
  }
}
```

---

### `GET /api/owner/health-overview`
Retrieves health summary for all properties owned by the authenticated owner using ONE single grouped SQL query (`$queryRaw` with window functions).
- **Auth**: Required (`OWNER` only)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "id": "732af6d7-5118-45a6-9703-043d47e0eb76",
      "title": "Smoke Test Health Property",
      "latestScore": "54.00",
      "grade": "D",
      "trend": null,
      "lastInspectedDate": "2026-11-22T11:34:00.000Z",
      "overdue": false
    }
  ]
}
```
*Note: A property is flagged as `overdue: true` if it has never been inspected or if its last completed inspection occurred more than 90 days ago.*

---

## 8. Service Providers & Maintenance Job Workflow Endpoints (Phase 4B)

### 8.1 Privacy & Contact Information Disclosure Rules
1. **Email Protection**: User and provider email addresses are **NEVER** exposed across any provider or maintenance request endpoints.
2. **Phone Number Disclosure**: Phone numbers are strictly redacted on all public endpoints and listing responses. The contact phone number is exposed **ONLY** on the single request detail endpoint (`GET /api/maintenance-requests/:id`) and **ONLY** between the property owner and the currently assigned service provider when the job is in `ASSIGNED`, `IN_PROGRESS`, or `COMPLETED` status.
3. **Resource Privacy (404 vs 403)**: Any user who does not own the property, is not the assigned provider, or is not an `ADMIN` receives a `404 NOT_FOUND` when attempting to access a maintenance request.

### 8.2 Maintenance Request State Transition Table

| Current Status | Allowed Action | Caller Role | New Status | Preconditions / Rules |
| :--- | :--- | :--- | :--- | :--- |
| `OPEN` | `assign` | `OWNER`, `ADMIN` | `ASSIGNED` | Provider must be `VERIFIED` and `isAvailable: true`. Must offer request's category. Row locked `FOR UPDATE`. |
| `OPEN` | `cancel` | `OWNER`, `ADMIN` | `CANCELLED` | Requires cancellation reason note (3-500 chars). |
| `ASSIGNED` | `unassign` | `OWNER`, `ADMIN` | `OPEN` | `providerId` set to `null`. Previous provider notified. |
| `ASSIGNED` | `decline` | Assigned `PROVIDER` | `OPEN` | `providerId` set to `null`. Reason note required. Owner notified. |
| `ASSIGNED` | `start` | Assigned `PROVIDER`, `ADMIN` | `IN_PROGRESS` | Work begins. Owner notified. |
| `ASSIGNED` | `cancel` | `OWNER`, `ADMIN` | `CANCELLED` | Cancellation reason note required. Provider notified. |
| `IN_PROGRESS` | `complete` | Assigned `PROVIDER`, `OWNER`, `ADMIN` | `COMPLETED` | Requires `actualCost` (non-negative, up to 2 decimal places). Counterpart notified. |
| `IN_PROGRESS` | `cancel` | `OWNER`, `ADMIN` | `CANCELLED` | Cancellation reason note required. Provider notified. |
| `COMPLETED` | `review` | `OWNER` | `COMPLETED` | Rating 1-5, optional comment. One review per maintenance request (duplicate returns `409 ALREADY_REVIEWED`). |

---

### 8.3 Service Provider Profile Endpoints

#### `POST /api/providers/profile`
Creates a service provider profile for the authenticated provider user. Starts in `PENDING` verification status.
- **Auth**: Required (`PROVIDER` only)
- **Body**:
```json
{
  "businessName": "Apex Maintenance & Plumbing",
  "bio": "Expert commercial and residential facility maintenance and repairs",
  "serviceAreaCity": "Bengaluru",
  "serviceAreaState": "Karnataka",
  "categoryIds": ["af611b61-cdf1-4eb2-988b-9ab5cbcd195b"]
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "id": "dd265228-b493-4d5c-8ab3-5db6a190119c",
    "profileId": "e869da10-2595-44db-a4e3-18fd247a8c18",
    "businessName": "Apex Maintenance & Plumbing",
    "bio": "Expert commercial and residential facility maintenance and repairs",
    "serviceAreaCity": "Bengaluru",
    "serviceAreaState": "Karnataka",
    "verificationStatus": "PENDING",
    "isAvailable": true,
    "categories": [
      {
        "id": "af611b61-cdf1-4eb2-988b-9ab5cbcd195b",
        "name": "Plumbing"
      }
    ]
  }
}
```
- **Errors**:
  - `400 VALIDATION_ERROR`: Missing business name, invalid categories, or attempt to inject `verificationStatus` (Zod `.strict()`).
  - `403 FORBIDDEN`: Non-`PROVIDER` roles.
  - `409 CONFLICT`: Provider profile already exists for this user account.

#### `GET /api/providers/me`
Retrieves own provider profile details, verification status, and offering categories.
- **Auth**: Required (`PROVIDER` only)
- **Response `200 OK`**: Same shape as `POST /api/providers/profile`.

#### `PATCH /api/providers/me`
Updates own business profile information or toggles availability.
- **Auth**: Required (`PROVIDER` only)
- **Body** (all fields optional):
```json
{
  "businessName": "Apex Facility Care",
  "bio": "Updated commercial bio",
  "isAvailable": false,
  "categoryIds": ["af611b61-cdf1-4eb2-988b-9ab5cbcd195b", "63221339-9256-42f7-b290-06d349633ff6"]
}
```
- **Response `200 OK`**: Updated profile object.
- **Note**: `verificationStatus` cannot be modified via this endpoint (strictly rejected).

#### `GET /api/providers`
Public directory of active, verified, and available service providers. Computes average ratings, review counts, and completed job counts using exactly TWO grouped database queries (`groupBy`).
- **Auth**: Optional / Public
- **Query Parameters**:
  - `categoryId`: Filter providers offering a specific category UUID
  - `city`: Case-insensitive filter by city
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 20, max: 100)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "id": "dd265228-b493-4d5c-8ab3-5db6a190119c",
      "businessName": "Apex Maintenance & Plumbing",
      "bio": "Expert commercial and residential facility maintenance and repairs",
      "serviceAreaCity": "Bengaluru",
      "serviceAreaState": "Karnataka",
      "isAvailable": true,
      "categories": [
        { "id": "af611b61-cdf1-4eb2-988b-9ab5cbcd195b", "name": "Plumbing" }
      ],
      "avgRating": "5.00",
      "reviewCount": 1,
      "completedJobsCount": 1
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

#### `GET /api/providers/:id`
Retrieves public detail of a specific provider.
- **Auth**: Optional / Public
- **Response `200 OK`**: Full provider profile with stats, recent reviews, and offerings.

#### `GET /api/providers/:id/reviews`
Retrieves reviews left for a specific provider.
- **Auth**: Optional / Public
- **Response `200 OK`**: Array of reviews with rating (1-5), comment, date, and reviewer name.

---

### 8.4 Admin Verification Endpoints

#### `GET /api/admin/providers`
Lists all service providers across all verification statuses (`PENDING`, `VERIFIED`, `REJECTED`).
- **Auth**: Required (`ADMIN` only)
- **Query Parameters**:
  - `status`: Optional filter (`PENDING`, `VERIFIED`, `REJECTED`)
  - `page`, `limit`
- **Response `200 OK`**: Array of provider records including owner profile details.

#### `PATCH /api/admin/providers/:id/verification`
Updates provider verification status. Sends an in-app notification to the provider upon status decision.
- **Auth**: Required (`ADMIN` only)
- **Body**:
```json
{
  "status": "VERIFIED",
  "note": "Trade license and insurance documents verified."
}
```
- **Response `200 OK`**: Updated provider record with `verificationStatus: "VERIFIED"`.

---

### 8.5 Maintenance Request & Job Workflow Endpoints

#### `POST /api/maintenance-requests`
Creates a new maintenance request on a property.
- **Auth**: Required (`OWNER` or `ADMIN`)
- **Body**:
```json
{
  "propertyId": "a9f04764-6242-4664-8cbe-d9870b07bb4d",
  "spaceId": null,
  "categoryId": "af611b61-cdf1-4eb2-988b-9ab5cbcd195b",
  "title": "High-pressure water valve leakage",
  "description": "Main shutoff valve in basement utility room has severe drip.",
  "priority": "HIGH",
  "estimatedCost": "500.00",
  "scheduledAt": "2026-12-01T10:00:00.000Z"
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "id": "ae42b32c-b612-4be6-bc21-c939dac23ed0",
    "propertyId": "a9f04764-6242-4664-8cbe-d9870b07bb4d",
    "propertyTitle": "Commercial Hub",
    "city": "Bengaluru",
    "spaceId": null,
    "categoryId": "af611b61-cdf1-4eb2-988b-9ab5cbcd195b",
    "categoryName": "Plumbing",
    "title": "High-pressure water valve leakage",
    "description": "Main shutoff valve in basement utility room has severe drip.",
    "priority": "HIGH",
    "status": "OPEN",
    "estimatedCost": "500.00",
    "scheduledAt": "2026-12-01T10:00:00.000Z",
    "createdAt": "2026-11-22T13:20:00.000Z"
  }
}
```

#### `GET /api/maintenance-requests`
Lists maintenance requests visible to the authenticated user.
- **Auth**: Required (`OWNER`, `PROVIDER`, `ADMIN`)
- **Query Parameters**:
  - `status`: Comma-separated list of statuses (e.g. `OPEN,ASSIGNED`)
  - `priority`: `LOW`, `MEDIUM`, `HIGH`, `URGENT`
  - `propertyId`: Filter by property
  - `categoryId`: Filter by category
  - `role`: Ignored for scoping; the caller's visibility scope is strictly enforced by their profile role (`OWNER` sees only their properties' requests, `PROVIDER` sees only their assigned jobs, `ADMIN` sees all requests)
  - `page`, `limit`
- **Response `200 OK`**: Paginated array of requests.

#### `GET /api/maintenance-requests/:id`
Retrieves detailed maintenance request with timeline notes, counterpart contact info, and caller `allowedActions`.
- **Auth**: Required (`OWNER` of property, assigned `PROVIDER`, or `ADMIN`; `404` for all others)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "id": "ae42b32c-b612-4be6-bc21-c939dac23ed0",
    "title": "High-pressure water valve leakage",
    "description": "Main shutoff valve in basement utility room has severe drip.",
    "priority": "HIGH",
    "status": "ASSIGNED",
    "scheduledAt": null,
    "estimatedCost": null,
    "actualCost": null,
    "completedAt": null,
    "createdAt": "2026-11-22T13:20:00.000Z",
    "updatedAt": "2026-11-22T13:21:00.000Z",
    "property": {
      "id": "a9f04764-6242-4664-8cbe-d9870b07bb4d",
      "title": "Commercial Hub",
      "addressLine1": "400 Industrial Blvd",
      "city": "Bengaluru",
      "state": "Karnataka",
      "postalCode": "560001"
    },
    "space": null,
    "category": { "id": "af611b61-cdf1-4eb2-988b-9ab5cbcd195b", "name": "Plumbing" },
    "provider": { "id": "dd265228-b493-4d5c-8ab3-5db6a190119c", "businessName": "Apex Maintenance & Plumbing" },
    "counterpartContact": {
      "role": "PROVIDER",
      "name": "Apex Staff",
      "phone": "+919876543210"
    },
    "updates": [
      {
        "id": "upd-1",
        "addedBy": "d484e52a-5c5d-460b-8311-0f4a54540b71",
        "authorName": "Property Owner",
        "note": "Status: OPEN -> ASSIGNED",
        "mediaUrl": null,
        "mediaType": null,
        "createdAt": "2026-11-22T13:21:00.000Z"
      }
    ],
    "review": null,
    "allowedActions": ["unassign", "cancel"]
  }
}
```

#### `PATCH /api/maintenance-requests/:id`
Updates request fields (only allowed while in `OPEN` or `ASSIGNED` status).
- **Auth**: Required (`OWNER` or `ADMIN`)
- **Body**: Updatable fields (`title`, `description`, `priority`, `categoryId`, `estimatedCost`, `scheduledAt`).
- **Response `200 OK`**: Updated request object.

#### `POST /api/maintenance-requests/:id/assign`
Assigns a verified provider to the request. Uses database row lock (`SELECT ... FOR UPDATE`).
- **Auth**: Required (`OWNER` or `ADMIN`)
- **Body**:
```json
{
  "providerId": "dd265228-b493-4d5c-8ab3-5db6a190119c",
  "scheduledAt": "2026-12-01T10:00:00.000Z",
  "estimatedCost": "450.00"
}
```
- **Response `200 OK`**: Request object with `status: "ASSIGNED"`.
- **Errors**:
  - `400 PROVIDER_NOT_VERIFIED`: Provider is not verified.
  - `400 PROVIDER_UNAVAILABLE`: Provider availability flag is false.
  - `400 CATEGORY_MISMATCH`: Provider does not service this category.
  - `409 INVALID_TRANSITION`: Request is not in `OPEN` status.

#### `POST /api/maintenance-requests/:id/unassign`
Unassigns currently assigned provider, returning status to `OPEN`.
- **Auth**: Required (`OWNER` or `ADMIN`)
- **Response `200 OK`**: Request with `status: "OPEN"` and `providerId: null`.

#### `POST /api/maintenance-requests/:id/decline`
Provider declines an assigned job, returning status to `OPEN`.
- **Auth**: Required (Assigned `PROVIDER` only)
- **Body**:
```json
{
  "reason": "Currently booked on emergency site inspections."
}
```
- **Response `200 OK`**: Request with `status: "OPEN"` and `providerId: null`.

#### `POST /api/maintenance-requests/:id/start`
Starts work on an assigned job.
- **Auth**: Required (Assigned `PROVIDER` or `ADMIN`)
- **Response `200 OK`**: Request with `status: "IN_PROGRESS"`.

#### `POST /api/maintenance-requests/:id/complete`
Completes an in-progress job with final actual cost.
- **Auth**: Required (Assigned `PROVIDER`, Property `OWNER`, or `ADMIN`)
- **Body**:
```json
{
  "actualCost": "450.00",
  "note": "Replaced valve seal, tested lines."
}
```
- **Response `200 OK`**: Request with `status: "COMPLETED"`, `actualCost: "450.00"`, and `completedAt`.

#### `POST /api/maintenance-requests/:id/cancel`
Cancels a maintenance request before completion. Allowed from `OPEN`, `ASSIGNED`, and `IN_PROGRESS` statuses. Requests in `COMPLETED` or `CANCELLED` status cannot be cancelled (returns `409 INVALID_TRANSITION`). If an assigned provider was present on the job, an in-app notification (`MAINTENANCE_CANCELLED`) is automatically dispatched to the provider.
- **Auth**: Required (Property `OWNER` or `ADMIN`)
- **Body**:
```json
{
  "reason": "Issue resolved by on-site staff."
}
```
- **Response `200 OK`**: Request with `status: "CANCELLED"`.
- **Errors**:
  - `400 VALIDATION_ERROR`: Reason string missing or not between 3-500 characters.
  - `404 NOT_FOUND`: Request not found or caller is not property owner / admin.
  - `409 INVALID_TRANSITION`: Request is already `COMPLETED` or `CANCELLED`.

#### `POST /api/maintenance-requests/:id/updates`
Posts an update note and optional photo to the job timeline. Photos are stored in the private `maintenance-media` Supabase bucket with magic-byte validation (JPEG, PNG, WebP) and return time-limited signed URLs.
- **Auth**: Required (Assigned `PROVIDER`, Property `OWNER`, or `ADMIN`)
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `note` (required text, 1-2000 chars)
  - `file` (optional image, max 5MB)
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "id": "upd-2",
    "maintenanceRequestId": "ae42b32c-b612-4be6-bc21-c939dac23ed0",
    "addedBy": "e869da10-2595-44db-a4e3-18fd247a8c18",
    "note": "Replaced valve seal, pressure tested lines, leak stopped.",
    "mediaUrl": "https://zohtnfconjrjvxmvpcvj.supabase.co/storage/v1/object/sign/maintenance-media/requests/...token=...",
    "mediaType": "image/png",
    "createdAt": "2026-11-22T13:25:00.000Z"
  }
}
```

#### `POST /api/maintenance-requests/:id/review`
Submits a provider review upon job completion.
- **Auth**: Required (Property `OWNER` only)
- **Body**:
```json
{
  "rating": 5,
  "comment": "Outstanding repair work and fast response!"
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "id": "rev-1",
    "providerId": "dd265228-b493-4d5c-8ab3-5db6a190119c",
    "reviewerId": "d484e52a-5c5d-460b-8311-0f4a54540b71",
    "maintenanceRequestId": "ae42b32c-b612-4be6-bc21-c939dac23ed0",
    "rating": 5,
    "comment": "Outstanding repair work and fast response!",
    "createdAt": "2026-11-22T13:28:00.000Z"
  }
}
```
- **Errors**:
  - `400 VALIDATION_ERROR`: Rating not in 1-5 or invalid format.
  - `409 INVALID_STATE`: Request is not in `COMPLETED` status.
  - `409 ALREADY_REVIEWED`: A review has already been submitted for this maintenance request.

---

## 9. Property Expenses & Private Receipts

Property expenses allow property owners and administrators to track operational costs, maintenance expenditures, utilities, taxes, insurance, and other property-related expenses. Receipts are stored in the private `receipts` Supabase Storage bucket and accessed exclusively via short-lived signed URLs (1 hour / 3600s).

Roles: Property `OWNER` and platform `ADMIN`. To prevent privacy leaks, users with `CUSTOMER` or `PROVIDER` roles receive `404 NOT_FOUND` on all expense endpoints.

Predefined Expense Categories:
`MAINTENANCE`, `UTILITIES`, `TAXES`, `INSURANCE`, `CLEANING`, `SUPPLIES`, `SALARY`, `OTHER`.

### 9.1 Expense Categories

#### `GET /api/expenses/categories`
Returns the list of valid expense categories.
- **Auth**: Required (`OWNER` or `ADMIN`)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    "MAINTENANCE",
    "UTILITIES",
    "TAXES",
    "INSURANCE",
    "CLEANING",
    "SUPPLIES",
    "SALARY",
    "OTHER"
  ]
}
```

---

### 9.2 Property Expenses Management

#### `POST /api/properties/:propertyId/expenses`
Creates a new property expense record.
- **Auth**: Required (Property `OWNER` or `ADMIN`)
- **Body**:
```json
{
  "category": "UTILITIES",
  "description": "Monthly electricity and water charges",
  "amount": 1250.50,
  "incurredOn": "2026-10-15",
  "maintenanceRequestId": "optional-uuid"
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "id": "3edfa1bb-7037-458a-ae05-7070f14fcc33",
    "propertyId": "0e9f1c19-4a79-42f5-9f7e-98dfc24198b6",
    "addedBy": "d484e52a-5c5d-460b-8311-0f4a54540b71",
    "maintenanceRequestId": null,
    "maintenanceTitle": null,
    "category": "UTILITIES",
    "description": "Monthly electricity and water charges",
    "amount": "1250.50",
    "incurredOn": "2026-10-15",
    "hasReceipt": false,
    "receiptUrl": null,
    "createdAt": "2026-10-15T12:00:00.000Z"
  }
}
```
- **Errors**:
  - `400 VALIDATION_ERROR`: Missing description, invalid category, amount <= 0 or > 2 decimal places, future date, extra unknown fields.
  - `404 NOT_FOUND`: Property not found or caller is not property owner / admin.
  - `409 EXPENSE_EXISTS`: An expense has already been recorded for the linked maintenance job.
  - `409 NOT_COMPLETED`: Linked maintenance job is not in `COMPLETED` status or lacks `actual_cost`.

#### `GET /api/properties/:propertyId/expenses`
Lists expenses for a property with pagination, filtering, and total amount aggregation covering all matching pages.
- **Auth**: Required (Property `OWNER` or `ADMIN`)
- **Query Parameters**:
  - `page` (integer, default `1`)
  - `limit` (integer, default `20`, max `100`)
  - `category` (comma-separated list, e.g. `UTILITIES,MAINTENANCE`)
  - `from` (`YYYY-MM-DD`)
  - `to` (`YYYY-MM-DD`)
  - `q` (search string against description)
  - `sort` (`newest` or `amount_desc`)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "id": "3edfa1bb-7037-458a-ae05-7070f14fcc33",
      "propertyId": "0e9f1c19-4a79-42f5-9f7e-98dfc24198b6",
      "addedBy": "d484e52a-5c5d-460b-8311-0f4a54540b71",
      "maintenanceRequestId": null,
      "maintenanceTitle": null,
      "category": "UTILITIES",
      "description": "Monthly electricity and water charges",
      "amount": "1250.50",
      "incurredOn": "2026-10-15",
      "hasReceipt": true,
      "receiptUrl": null,
      "createdAt": "2026-10-15T12:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1,
    "totalAmount": "1250.50"
  }
}
```

#### `GET /api/properties/:propertyId/expenses/summary`
Returns aggregated expense totals, category breakdown, and monthly breakdown. Executes exactly two grouped SQL queries. Ensures every month in the selected range is represented (with `0.00` if no expenses occurred).
- **Auth**: Required (Property `OWNER` or `ADMIN`)
- **Query Parameters**:
  - `year` (`YYYY`, defaults to current year)
  - `from` (`YYYY-MM-DD`)
  - `to` (`YYYY-MM-DD`)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "total": "1700.50",
    "count": 2,
    "byCategory": [
      {
        "category": "UTILITIES",
        "total": "1250.50",
        "count": 1,
        "percent": "73.5"
      },
      {
        "category": "MAINTENANCE",
        "total": "450.00",
        "count": 1,
        "percent": "26.5"
      }
    ],
    "byMonth": [
      { "month": "2026-01", "total": "0.00" },
      { "month": "2026-02", "total": "0.00" },
      { "month": "2026-03", "total": "0.00" },
      { "month": "2026-04", "total": "0.00" },
      { "month": "2026-05", "total": "0.00" },
      { "month": "2026-06", "total": "0.00" },
      { "month": "2026-07", "total": "0.00" },
      { "month": "2026-08", "total": "0.00" },
      { "month": "2026-09", "total": "0.00" },
      { "month": "2026-10", "total": "1700.50" },
      { "month": "2026-11", "total": "0.00" },
      { "month": "2026-12", "total": "0.00" }
    ]
  }
}
```

---

### 9.3 Single Expense Operations

#### `GET /api/expenses/:id`
Retrieves single expense details, temporary signed URL for receipt (valid 3600s), and discrepancy warning (`jobCostMismatch`) if the expense was edited away from the linked maintenance job's actual cost.
- **Auth**: Required (Property `OWNER` or `ADMIN`)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "id": "3edfa1bb-7037-458a-ae05-7070f14fcc33",
    "propertyId": "0e9f1c19-4a79-42f5-9f7e-98dfc24198b6",
    "addedBy": "d484e52a-5c5d-460b-8311-0f4a54540b71",
    "maintenanceRequestId": "3e27926a-99df-421a-acfc-8db223d3c088",
    "maintenanceTitle": "Emergency Pipe Repair",
    "category": "MAINTENANCE",
    "description": "Invoice payment for Pipe Repair job",
    "amount": "550.00",
    "incurredOn": "2026-10-16",
    "hasReceipt": true,
    "receiptUrl": "https://zohtnfconjrjvxmvpcvj.supabase.co/storage/v1/object/sign/receipts/0e9f1c19.../file.pdf?token=...",
    "createdAt": "2026-10-16T10:00:00.000Z",
    "jobCostMismatch": true,
    "jobActualCost": "450.00",
    "expenseAmount": "550.00"
  }
}
```

#### `PATCH /api/expenses/:id`
Updates expense category, description, amount, or incurredOn. Changing property or linked maintenance request is forbidden.
- **Auth**: Required (Property `OWNER` or `ADMIN`)
- **Body**:
```json
{
  "category": "MAINTENANCE",
  "description": "Updated description",
  "amount": 550.00,
  "incurredOn": "2026-10-16"
}
```
- **Response `200 OK`**: Returns updated formatted expense.

#### `DELETE /api/expenses/:id`
Hard deletes an expense record. Automatically cascades deletion to remove any uploaded receipt file in Supabase Storage (`receipts` bucket) and its corresponding `media_assets` row.
- **Auth**: Required (Property `OWNER` or `ADMIN`)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "message": "Expense deleted successfully"
  }
}
```

---

### 9.4 Receipt Attachments

#### `POST /api/expenses/:id/receipt`
Uploads or replaces an expense receipt document in the private `receipts` bucket. Enforces magic-byte validation (accepts JPEG, PNG, WebP, PDF; strictly rejects SVG). If replacing an existing receipt, the previous storage object and `media_assets` row are deleted only after the new file and database transaction succeed.
- **Auth**: Required (Property `OWNER` or `ADMIN`)
- **Content-Type**: `multipart/form-data`
- **Fields**: `file` (single binary file, max 5MB)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "receiptUrl": "https://zohtnfconjrjvxmvpcvj.supabase.co/storage/v1/object/sign/receipts/.../invoice.pdf?token=..."
  }
}
```
- **Errors**:
  - `400 INVALID_FILE_TYPE`: File does not match JPEG, PNG, WebP, or PDF magic bytes.
  - `413 FILE_TOO_LARGE`: File exceeds 5MB size limit.

#### `DELETE /api/expenses/:id/receipt`
Deletes the receipt file from private storage, deletes its `media_assets` row, and clears `receipt_url` on the expense.
- **Auth**: Required (Property `OWNER` or `ADMIN`)
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "message": "Receipt deleted successfully"
  }
}
```

---

### 9.5 Record Expense from Completed Maintenance Job

#### `POST /api/maintenance-requests/:id/expense`
One-click action to record an expense from a completed maintenance job.
- Enforces row lock `SELECT ... FOR UPDATE` inside a database transaction.
- Verifies job is `COMPLETED` and has `actual_cost` (rejects with `409 NOT_COMPLETED` otherwise).
- Enforces strict one-expense-per-job rule (rejects with `409 EXPENSE_EXISTS` if an expense already exists).
- Defaults category to `MAINTENANCE` and amount to job's `actual_cost`.
- Links maintenance request and updates `linkedExpenseId` on the maintenance job.
- **Auth**: Required (Property `OWNER` or `ADMIN`)
- **Body**:
```json
{
  "description": "Invoice payment for Pipe Repair job",
  "incurredOn": "2026-10-16"
}
```
- **Response `201 Created`**:
```json
{
  "success": true,
  "data": {
    "id": "5e3d8d84-6aac-4861-83db-bd75ca6532c9",
    "propertyId": "0e9f1c19-4a79-42f5-9f7e-98dfc24198b6",
    "addedBy": "d484e52a-5c5d-460b-8311-0f4a54540b71",
    "maintenanceRequestId": "3e27926a-99df-421a-acfc-8db223d3c088",
    "maintenanceTitle": "Emergency Pipe Repair",
    "category": "MAINTENANCE",
    "description": "Invoice payment for Pipe Repair job",
    "amount": "450.00",
    "incurredOn": "2026-10-16",
    "hasReceipt": false,
    "receiptUrl": null,
    "createdAt": "2026-10-16T12:00:00.000Z"
  }
}
```
- **Errors**:
  - `404 NOT_FOUND`: Maintenance request not found or caller does not own property.
  - `409 NOT_COMPLETED`: Job is not completed or missing actual cost.
  - `409 EXPENSE_EXISTS`: An expense has already been recorded for this maintenance job.

---

## 10. Owner & Admin Dashboard Endpoints (Phase 4D)

### 10.1 Financial Definitions & Calculation Engine
All monetary values and percentages are computed with decimal precision using `Prisma.Decimal` and SQL `NUMERIC` with `ROUND_HALF_UP` to 2 decimal places. They are serialized as `"X.XX"` strings. Float math is strictly forbidden.

1. **Date Range**:
   - `from` and `to` (ISO `YYYY-MM-DD`). Defaults to the last 12 calendar months ending today in the `Asia/Kolkata` timezone.
   - Continuous month series across year boundaries (e.g. `2025-12` -> `2026-01`), with zeros filled for empty months.
2. **incomeReceived**:
   - Sum of the owner's share of `PAID` payments within the date range (`paid_at` between `rangeStart` and `rangeEnd`):
     $$\text{ownerShare} = \text{ROUND}\left(\text{payment.amount} \times \frac{\text{booking.owner\_amount}}{\text{NULLIF}(\text{booking.total\_amount}, 0)}, 2\right)$$
   - Only `PAID` payments count. `REFUNDED` and `PENDING` payments are excluded.
3. **grossCollected**:
   - Sum of all `PAID` payment amounts within the range (`SUM(p.amount)`).
4. **platformFeesPaid & taxCollected**:
   - Matching proportional shares of `PAID` payments:
     $$\text{platformFeeShare} = \text{ROUND}\left(p.\text{amount} \times \frac{b.\text{platform\_fee}}{\text{NULLIF}(b.\text{total\_amount}, 0)}, 2\right)$$
     $$\text{taxShare} = \text{ROUND}\left(p.\text{amount} \times \frac{b.\text{tax\_amount}}{\text{NULLIF}(b.\text{total\_amount}, 0)}, 2\right)$$
5. **roundingDifference**:
   - Residual difference due to independent 2-decimal rounding:
     $$\text{roundingDifference} = \text{grossCollected} - (\text{incomeReceived} + \text{platformFeesPaid} + \text{taxCollected})$$
6. **incomeExpected**:
   - Owner share of bookings with status `CONFIRMED` or `COMPLETED` whose `start_at` falls in the range, minus the owner share already paid for them:
     $$\text{incomeExpected} = \text{SUM}\left(\text{GREATEST}(0, b.\text{owner\_amount} - \text{COALESCE}(\text{paidOwnerShare}, 0))\right)$$
7. **expenses**:
   - Sum of `property_expenses.amount` where `incurred_on` is within the date range for the owner's properties.
8. **net**:
   - $$\text{net} = \text{incomeReceived} - \text{expenses}$$
9. **refundedAmount**:
   - Sum of all `REFUNDED` payment amounts within the range.
10. **occupancy**:
    - Booked hours of `CONFIRMED` and `COMPLETED` bookings clipped to `[rangeStart, rangeEnd]`:
      $$\text{clippedHours} = \frac{\text{LEAST}(b.\text{end\_at}, \text{rangeEnd}) - \text{GREATEST}(b.\text{start\_at}, \text{rangeStart})}{3600}$$
    - Divided by available space-hours ($24 \times \text{daysInRange} \times \text{availableSpaces}$), as a percentage rounded to 1 decimal place, capped at 100. Returns `null` when no spaces exist.
11. **Query Scalability**:
    - The dashboard endpoint executes no more than 12 SQL queries in total via parallel `Promise.all` ($O(1)$ query count, independent of number of properties, spaces, or bookings).

---

### 10.2 Endpoints

#### `GET /api/owner/dashboard`
Returns comprehensive dashboard overview for the authenticated owner (or specified owner for `ADMIN`).
- **Auth**: Required (`OWNER` or `ADMIN`). `CUSTOMER` and `PROVIDER` receive `404 NOT_FOUND` to protect endpoint existence.
- **Query Parameters**:
  - `from` *(string, optional)*: ISO date (`YYYY-MM-DD`).
  - `to` *(string, optional)*: ISO date (`YYYY-MM-DD`).
  - `propertyId` *(string, optional, UUID)*: Filter metrics to a single property owned by the user. If property belongs to another owner, returns `404 NOT_FOUND`.
  - `ownerId` *(string, optional, UUID, ADMIN only)*: Scope metrics to a specific owner.
- **Headers**:
  - `X-Query-Count`: Returns `"12"` reflecting the fixed parallel SQL query count.
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "range": {
      "from": "2025-12-01",
      "to": "2026-11-22"
    },
    "totals": {
      "incomeReceived": "18400.00",
      "incomeExpected": "3200.00",
      "expenses": "4250.00",
      "net": "14150.00",
      "grossCollected": "24120.00",
      "platformFeesPaid": "2044.00",
      "taxCollected": "3676.00",
      "refundedAmount": "1840.00",
      "roundingDifference": "0.00"
    },
    "series": [
      {
        "month": "2025-12",
        "incomeReceived": "1200.00",
        "expenses": "450.00",
        "net": "750.00"
      },
      {
        "month": "2026-01",
        "incomeReceived": "1500.00",
        "expenses": "300.00",
        "net": "1200.00"
      }
    ],
    "bookingCounts": {
      "PENDING": 2,
      "CONFIRMED": 5,
      "CANCELLED": 4,
      "COMPLETED": 20,
      "REJECTED": 1
    },
    "bookingsThisPeriod": 28,
    "occupancy": 34.5,
    "topSpaces": [
      {
        "spaceId": "b1a7d652-3d84-48f8-b391-76a03e659b8a",
        "spaceName": "Grand Executive Suite",
        "propertyTitle": "Nexora Horizon Tower",
        "incomeReceived": "9200.00",
        "bookingCount": 14
      }
    ],
    "maintenance": {
      "countsByStatus": {
        "OPEN": 2,
        "ASSIGNED": 1,
        "IN_PROGRESS": 1,
        "COMPLETED": 4,
        "CANCELLED": 0
      },
      "urgentHighOpenCount": 2,
      "totalActualCost": "1850.00"
    },
    "health": {
      "properties": [
        {
          "propertyId": "a2b3c4d5-e6f7-4890-abcd-1234567890ab",
          "title": "Nexora Horizon Tower",
          "score": "91.25",
          "grade": "A",
          "trend": "IMPROVING",
          "overdue": false
        }
      ],
      "overdueProperties": 0
    },
    "upcoming": {
      "nextBookings": [
        {
          "id": "e4f5a6b7-c8d9-4012-ef34-567890abcdef",
          "startAt": "2026-11-25T10:00:00.000Z",
          "endAt": "2026-11-25T14:00:00.000Z",
          "spaceName": "Boardroom Alpha",
          "propertyTitle": "Nexora Horizon Tower",
          "customerFirstName": "Aryan"
        }
      ],
      "nextInspections": [
        {
          "id": "c1d2e3f4-a5b6-4789-0123-456789abcdef",
          "scheduledAt": "2026-11-30T09:00:00.000Z",
          "propertyTitle": "Nexora Horizon Tower"
        }
      ],
      "nextMaintenance": [
        {
          "id": "d2e3f4a5-b6c7-4890-1234-567890abcdef",
          "scheduledAt": "2026-11-28T11:00:00.000Z",
          "title": "HVAC Filter Replacement",
          "priority": "HIGH",
          "propertyTitle": "Nexora Horizon Tower"
        }
      ]
    },
    "recentActivity": [
      {
        "type": "PAYMENT",
        "text": "Payment of ₹1180.00 received for Boardroom Alpha",
        "time": "2026-11-20T14:30:00.000Z"
      },
      {
        "type": "MAINTENANCE",
        "text": "HVAC Repair: Replacement parts delivered [REDACTED_PHONE]",
        "time": "2026-11-19T10:15:00.000Z"
      }
    ]
  }
}
```

---

#### `GET /api/owner/dashboard/properties`
Returns a tabular view of all properties owned by the caller with period metrics, occupancy, and health overview in a single query set.
- **Auth**: Required (`OWNER` or `ADMIN`).
- **Query Parameters**:
  - `from` *(string, optional)*: ISO date (`YYYY-MM-DD`).
  - `to` *(string, optional)*: ISO date (`YYYY-MM-DD`).
  - `ownerId` *(string, optional, UUID, ADMIN only)*.
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": [
    {
      "propertyId": "a2b3c4d5-e6f7-4890-abcd-1234567890ab",
      "title": "Nexora Horizon Tower",
      "addressLine1": "100 Outer Ring Road",
      "city": "Bengaluru",
      "incomeReceived": "12400.00",
      "expenses": "2150.00",
      "net": "10250.00",
      "occupancy": 42.1,
      "bookingCount": 18,
      "healthScore": "91.25",
      "healthGrade": "A",
      "healthTrend": "IMPROVING",
      "overdue": false
    }
  ]
}
```

---

#### `GET /api/owner/dashboard/reconcile`
Debug and audit reconciliation endpoint returning paginated raw payments and expenses for mathematical verification.
- **Auth**: Required (`OWNER` or `ADMIN`).
- **Query Parameters**:
  - `from` *(string, optional)*: ISO date.
  - `to` *(string, optional)*: ISO date.
  - `propertyId` *(string, optional, UUID)*.
  - `ownerId` *(string, optional, UUID, ADMIN only)*.
  - `page` *(number, optional, default: 1)*.
  - `limit` *(number, optional, default: 50, max: 200)*.
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "totals": {
      "incomeReceived": "18400.00",
      "expenses": "4250.00",
      "net": "14150.00"
    },
    "payments": [
      {
        "id": "p1a2b3c4-d5e6-4789-8901-234567890abc",
        "bookingId": "b1a2b3c4-d5e6-4789-8901-234567890abc",
        "paidAt": "2026-10-15T12:00:00.000Z",
        "amount": "1180.00",
        "ownerShare": "900.00",
        "platformFeeShare": "100.00",
        "taxShare": "180.00"
      }
    ],
    "expenses": [
      {
        "id": "e1a2b3c4-d5e6-4789-8901-234567890abc",
        "propertyId": "a2b3c4d5-e6f7-4890-abcd-1234567890ab",
        "incurredOn": "2026-10-12",
        "category": "UTILITIES",
        "amount": "450.00",
        "description": "Monthly water & electricity utility bill"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "totalPayments": 22,
      "totalExpenses": 14
    }
  }
}
```

---

#### `GET /api/admin/dashboard`
Returns platform-wide metrics with zero PII or personally identifiable names.
- **Auth**: Required (`ADMIN`).
- **Query Parameters**:
  - `from` *(string, optional)*: ISO date.
  - `to` *(string, optional)*: ISO date.
- **Response `200 OK`**:
```json
{
  "success": true,
  "data": {
    "range": {
      "from": "2025-12-01",
      "to": "2026-11-22"
    },
    "grossVolume": "25960.00",
    "platformFeesEarned": "2200.00",
    "bookingsByStatus": {
      "PENDING": 3,
      "CONFIRMED": 8,
      "CANCELLED": 8,
      "COMPLETED": 22,
      "REJECTED": 3
    },
    "usersByRole": {
      "CUSTOMER": 15,
      "OWNER": 4,
      "PROVIDER": 6,
      "ADMIN": 2
    },
    "activeProperties": 8,
    "pendingProviderVerifications": 1,
    "openMaintenance": 5
  }
}
```

---

### 10.3 Demo Data CLI Commands

```bash
# 1. Seed comprehensive realistic demo data for an owner (Idempotent with [DEMO] marker)
npm run seed:dashboard -- <owner-email>

# 2. Safely remove demo rows carrying the [DEMO] marker
npm run seed:dashboard:remove -- --yes

# 3. Run automated Phase 4D smoke test suite
npm run smoke:dashboard
```





