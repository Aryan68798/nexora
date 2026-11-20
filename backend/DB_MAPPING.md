# Nexora — Database Schema & Prisma Mapping Reference

> **CRITICAL ARCHITECTURAL DIRECTIVE:**  
> **Prisma manages only the public schema. The FK profiles.id -> auth.users.id exists in the database but is not modeled in Prisma. Never run `prisma db pull`.**  
> `schema.prisma` is now the source of truth. Running `db pull` would fail with cross-schema foreign key errors or re-import the unmanaged `auth` schema, and wipe the carefully defined `@map` annotations, relation aliases, model ignores, and casing alignments.

---

## 1. Overview & Strategy
- **Database Engine**: PostgreSQL on Supabase.
- **ORM**: Prisma 7 (`@prisma/client` with `@prisma/adapter-pg`).
- **Mapping Pattern**: All JavaScript (ES modules) application code uses clean, idiomatic `camelCase` field names and `PascalCase` model names. The database retains its exact existing `snake_case` column names via `@map` and table names via `@@map`.
- **Zero Breaking / Destructive Operations**: No existing table, column, or enum in Supabase was dropped or altered in type. All migrations are strictly additive.

---

## 2. Enum Mappings & Value Alignments

### `price_unit`
- **Database Values**: `HOUR`, `DAY`
- **Prisma Enum**: `price_unit`
- **Application Note**: Billing intervals supported in this phase are hourly (`HOUR`) and daily (`DAY`).

### `space_type`
- **Database Values**: `ROOM`, `OFFICE`, `SHOP`, `STUDIO`, `CLASSROOM`, `PARKING`, `OTHER`
- **Prisma Enum**: `space_type`
- **Application Note**: Represents the physical categorization of listable spaces.

### `ai_action_status`
- **Database Values**: `REQUESTED`, `CONFIRMED`, `EXECUTED`, `FAILED`, `CANCELLED`
- **Prisma Enum**: `ai_action_status`
- **Application Note**: The status value **`REQUESTED`** represents *"pending user confirmation"* for actions invoked by the AI Harness before execution.

### String-Based Enums with Validated CHECK Constraints
The following fields are stored as `VARCHAR` in PostgreSQL and typed as `String` in Prisma, with database integrity enforced by custom idempotent `CHECK` constraints:
- **`payments.payment_method`**: Constrained to `('CARD', 'UPI', 'NET_BANKING', 'CASH', 'WALLET')`.
- **`inspection_items.condition`**: Constrained to `('EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL')`.
- **`service_providers.verification_status`**: Constrained to `('PENDING', 'VERIFIED', 'REJECTED')` with default `'PENDING'`.

### `user_role`
- **Database Values**: `OWNER`, `CUSTOMER`, `PROVIDER`, `ADMIN`
- **Default**: `CUSTOMER`

---

## 3. Comprehensive Prisma Field ↔ DB Column Mappings

### 1. `profiles`
Mapped to table: `profiles`
| Prisma Model Field | Database Column | Type / Nullability | Constraints & Notes |
| :--- | :--- | :--- | :--- |
| `id` | `id` | `UUID NOT NULL` | Primary Key (matches `auth.users.id`; DB FK `profiles_id_fkey` preserved, unmodeled in Prisma) |
| `name` | `name` | `VARCHAR(100) NOT NULL` | Full display name |
| `email` | `email` | `VARCHAR(254) NOT NULL` | Unique constraint (`profiles_email_key`) |
| `phone` | `phone` | `VARCHAR(20) NULL` | Optional contact phone |
| `role` | `role` | `user_role NOT NULL` | Default `CUSTOMER` |
| `isActive` | `is_active` | `BOOLEAN NOT NULL` | Default `true` |
| `avatarUrl` | `avatar_url` | `TEXT NULL` | Added in migration `add_missing_pieces` |
| `createdAt` | `created_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |
| `updatedAt` | `updated_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |

### 2. `properties`
Mapped to table: `properties`
| Prisma Model Field | Database Column | Type / Nullability | Constraints & Notes |
| :--- | :--- | :--- | :--- |
| `id` | `id` | `UUID NOT NULL` | PK, `default gen_random_uuid()` |
| `ownerId` | `owner_id` | `UUID NOT NULL` | FK -> `profiles.id` (Indexed) |
| `title` | `title` | `VARCHAR(200) NOT NULL` | Property headline |
| `description` | `description` | `TEXT NULL` | Detailed description |
| `propertyType` | `property_type` | `VARCHAR(50) NOT NULL` | E.g. Commercial, Residential, Co-working |
| `addressLine1` | `address_line1` | `VARCHAR(255) NOT NULL` | Primary address |
| `addressLine2` | `address_line2` | `VARCHAR(255) NULL` | Unit / Suite / Floor |
| `city` | `city` | `VARCHAR(100) NOT NULL` | City |
| `state` | `state` | `VARCHAR(100) NOT NULL` | State |
| `postalCode` | `postal_code` | `VARCHAR(20) NULL` | Pin/Postal code |
| `country` | `country` | `VARCHAR(100) NOT NULL` | Default `'India'` |
| `latitude` | `latitude` | `DECIMAL(9,6) NULL` | Geographic coordinate |
| `longitude` | `longitude` | `DECIMAL(9,6) NULL` | Geographic coordinate |
| `status` | `status` | `property_status NOT NULL`| Default `ACTIVE` |
| `createdAt` | `created_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |
| `updatedAt` | `updated_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |

### 3. `property_media`
Mapped to table: `property_media`
| Prisma Model Field | Database Column | Type / Nullability | Constraints & Notes |
| :--- | :--- | :--- | :--- |
| `id` | `id` | `UUID NOT NULL` | PK |
| `propertyId` | `property_id` | `UUID NOT NULL` | FK -> `properties.id` (Indexed) |
| `url` | `url` | `TEXT NOT NULL` | Public/signed access URL |
| `mediaType` | `media_type` | `VARCHAR(20) NOT NULL` | E.g. IMAGE, VIDEO |
| `caption` | `caption` | `VARCHAR(255) NULL` | Display caption / alt text |
| `storagePath` | `storage_path` | `VARCHAR(500) NULL` | Added (Supabase storage object key) |
| `isCover` | `is_cover` | `BOOLEAN NOT NULL` | Added (Default `false`) |
| `sortOrder` | `sort_order` | `INTEGER NOT NULL` | Default `0` |
| `createdAt` | `created_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |

### 4. `spaces`
Mapped to table: `spaces`
| Prisma Model Field | Database Column | Type / Nullability | Constraints & Notes |
| :--- | :--- | :--- | :--- |
| `id` | `id` | `UUID NOT NULL` | PK |
| `propertyId` | `property_id` | `UUID NOT NULL` | FK -> `properties.id` (Indexed) |
| `name` | `name` | `VARCHAR(150) NOT NULL` | Space name / descriptor |
| `description` | `description` | `TEXT NULL` | Description |
| `spaceType` | `space_type` | `space_type NOT NULL` | Native enum (`ROOM`, `OFFICE`, etc.) |
| `capacity` | `capacity` | `INTEGER NULL` | Maximum guest capacity (`CHECK > 0`) |
| `priceAmount` | `price_amount` | `DECIMAL(12,2) NOT NULL`| Base price (`CHECK >= 0`) |
| `priceUnit` | `price_unit` | `price_unit NOT NULL` | Enum (`HOUR`, `DAY`) |
| `status` | `status` | `space_status NOT NULL` | Default `AVAILABLE` |
| `rules` | `rules` | `TEXT NULL` | Space rules / guidelines |
| `createdAt` | `created_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |
| `updatedAt` | `updated_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |

### 5. `space_media`
Mapped to table: `space_media`
| Prisma Model Field | Database Column | Type / Nullability | Constraints & Notes |
| :--- | :--- | :--- | :--- |
| `id` | `id` | `UUID NOT NULL` | PK |
| `spaceId` | `space_id` | `UUID NOT NULL` | FK -> `spaces.id` (Indexed) |
| `url` | `url` | `TEXT NOT NULL` | Media URL |
| `mediaType` | `media_type` | `VARCHAR(20) NOT NULL` | E.g. IMAGE |
| `caption` | `caption` | `VARCHAR(255) NULL` | Caption |
| `storagePath` | `storage_path` | `VARCHAR(500) NULL` | Added |
| `isCover` | `is_cover` | `BOOLEAN NOT NULL` | Added (Default `false`) |
| `sortOrder` | `sort_order` | `INTEGER NOT NULL` | Default `0` |
| `createdAt` | `created_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |

### 6. `bookings`
Mapped to table: `bookings`
| Prisma Model Field | Database Column | Type / Nullability | Constraints & Notes |
| :--- | :--- | :--- | :--- |
| `id` | `id` | `UUID NOT NULL` | PK |
| `spaceId` | `space_id` | `UUID NOT NULL` | FK -> `spaces.id` (Composite indexed with start/end) |
| `customerId` | `customer_id` | `UUID NOT NULL` | FK -> `profiles.id` (Indexed) |
| `startAt` | `start_at` | `TIMESTAMPTZ NOT NULL` | Booking start (`CHECK end_at > start_at`) |
| `endAt` | `end_at` | `TIMESTAMPTZ NOT NULL` | Booking end |
| `guestCount` | `guest_count` | `INTEGER NOT NULL` | Number of occupants (`CHECK > 0`) |
| `status` | `status` | `booking_status NOT NULL`| Booking workflow status |
| `subtotal` | `base_amount` | `DECIMAL(12,2) NOT NULL`| Base cost (`CHECK >= 0`) |
| `platformFee` | `platform_fee` | `DECIMAL(12,2) NOT NULL`| Platform commission (`CHECK >= 0`, Default 0) |
| `ownerAmount` | `owner_amount` | `DECIMAL(12,2) NOT NULL`| Payout to owner (`CHECK >= 0`) |
| `taxAmount` | `tax_amount` | `DECIMAL(12,2) NOT NULL`| Added (`CHECK >= 0`, Default 0) |
| `totalAmount` | `total_amount` | `DECIMAL(12,2) NOT NULL`| Total charged to customer (`CHECK >= 0`) |
| `cancellationReason` | `cancellation_reason`| `TEXT NULL` | Optional cancellation explanation |
| `createdAt` | `created_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |
| `updatedAt` | `updated_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |

### 7. `booking_status_history`
Mapped to table: `booking_status_history`
| Prisma Model Field | Database Column | Type / Nullability | Constraints & Notes |
| :--- | :--- | :--- | :--- |
| `id` | `id` | `UUID NOT NULL` | PK |
| `bookingId` | `booking_id` | `UUID NOT NULL` | FK -> `bookings.id` (Indexed) |
| `fromStatus` | `from_status` | `booking_status NULL` | Added (Nullable prior status) |
| `toStatus` | `status` | `booking_status NOT NULL`| Current / new transition status |
| `changedById` | `changed_by` | `UUID NOT NULL` | FK -> `profiles.id` (Indexed) |
| `note` | `note` | `TEXT NULL` | Transition comment |
| `changedAt` | `changed_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |

### 8. `payments`
Mapped to table: `payments`
| Prisma Model Field | Database Column | Type / Nullability | Constraints & Notes |
| :--- | :--- | :--- | :--- |
| `id` | `id` | `UUID NOT NULL` | PK |
| `bookingId` | `booking_id` | `UUID NOT NULL` | FK -> `bookings.id` (Indexed) |
| `payerId` | `payer_id` | `UUID NOT NULL` | FK -> `profiles.id` (Indexed) |
| `amount` | `amount` | `DECIMAL(12,2) NOT NULL`| Payment amount (`CHECK >= 0`) |
| `currency` | `currency` | `VARCHAR(10) NOT NULL` | Default `'INR'` |
| `paymentMethod` | `payment_method` | `VARCHAR(50) NOT NULL` | Constrained (`CARD`, `UPI`, `NET_BANKING`, etc.) |
| `status` | `status` | `payment_status NOT NULL`| Default `PENDING` |
| `transactionReference`| `transaction_reference`| `VARCHAR(255) NULL` | Gateway transaction identifier |
| `paidAt` | `paid_at` | `TIMESTAMPTZ NULL` | Timestamp of successful payment capture |
| `createdAt` | `created_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |

### 9. `property_expenses`
Mapped to table: `property_expenses`
| Prisma Model Field | Database Column | Type / Nullability | Constraints & Notes |
| :--- | :--- | :--- | :--- |
| `id` | `id` | `UUID NOT NULL` | PK |
| `propertyId` | `property_id` | `UUID NOT NULL` | FK -> `properties.id` (Indexed) |
| `addedById` | `added_by` | `UUID NOT NULL` | FK -> `profiles.id` (Indexed) |
| `maintenanceRequestId` | `maintenance_request_id` | `UUID NULL` | FK -> `maintenance_requests.id` (Indexed) |
| `category` | `category` | `VARCHAR(50) NOT NULL` | Category (e.g. Repairs, Utilities) |
| `description` | `description` | `TEXT NOT NULL` | Expense description |
| `amount` | `amount` | `DECIMAL(12,2) NOT NULL`| Cost amount (`CHECK >= 0`) |
| `incurredOn` | `incurred_on` | `DATE NOT NULL` | Incurred calendar date |
| `receiptUrl` | `receipt_url` | `TEXT NULL` | Uploaded receipt image/document URL |
| `createdAt` | `created_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |

### 10. `inspections`
Mapped to table: `inspections`
| Prisma Model Field | Database Column | Type / Nullability | Constraints & Notes |
| :--- | :--- | :--- | :--- |
| `id` | `id` | `UUID NOT NULL` | PK |
| `propertyId` | `property_id` | `UUID NOT NULL` | FK -> `properties.id` (Indexed) |
| `inspectorId` | `inspector_id` | `UUID NOT NULL` | FK -> `profiles.id` (Indexed) |
| `scheduledAt` | `scheduled_at` | `TIMESTAMPTZ NOT NULL` | Inspection schedule |
| `completedAt` | `inspected_at` | `TIMESTAMPTZ NULL` | Actual inspection execution timestamp |
| `status` | `status` | `inspection_status NOT NULL` | Default `SCHEDULED` |
| `conditionScore`| `overall_condition_score`| `DECIMAL(5,2) NULL` | Score 0–100 (`CHECK BETWEEN 0 AND 100`) |
| `summary` | `summary` | `TEXT NULL` | Executive findings summary |
| `reportUrl` | `report_url` | `TEXT NULL` | PDF report URL |
| `createdAt` | `created_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |
| `updatedAt` | `updated_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |

### 11. `inspection_items`
Mapped to table: `inspection_items`
| Prisma Model Field | Database Column | Type / Nullability | Constraints & Notes |
| :--- | :--- | :--- | :--- |
| `id` | `id` | `UUID NOT NULL` | PK |
| `inspectionId` | `inspection_id` | `UUID NOT NULL` | FK -> `inspections.id` (Indexed) |
| `itemName` | `item_name` | `VARCHAR(100) NOT NULL` | E.g. HVAC, Fire Extinguisher |
| `category` | `category` | `VARCHAR(50) NOT NULL` | Item category |
| `condition` | `condition` | `VARCHAR(20) NOT NULL` | Constrained (`EXCELLENT`, `GOOD`, `FAIR`, `POOR`, `CRITICAL`) |
| `notes` | `notes` | `TEXT NULL` | Inspector observations |
| `checkedAt` | `checked_at` | `TIMESTAMPTZ NULL` | Item verification timestamp |

### 12. `inspection_media`
Mapped to table: `inspection_media`
| Prisma Model Field | Database Column | Type / Nullability | Constraints & Notes |
| :--- | :--- | :--- | :--- |
| `id` | `id` | `UUID NOT NULL` | PK |
| `inspectionId` | `inspection_id` | `UUID NOT NULL` | FK -> `inspections.id` (Indexed) |
| `url` | `url` | `TEXT NOT NULL` | Media URL |
| `mediaType` | `media_type` | `VARCHAR(20) NOT NULL` | E.g. IMAGE |
| `caption` | `caption` | `VARCHAR(255) NULL` | Caption |
| `createdAt` | `created_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |

### 13. `maintenance_requests`
Mapped to table: `maintenance_requests`
| Prisma Model Field | Database Column | Type / Nullability | Constraints & Notes |
| :--- | :--- | :--- | :--- |
| `id` | `id` | `UUID NOT NULL` | PK |
| `propertyId` | `property_id` | `UUID NOT NULL` | FK -> `properties.id` (Indexed) |
| `spaceId` | `space_id` | `UUID NULL` | FK -> `spaces.id` (Indexed) |
| `requesterId` | `requested_by` | `UUID NOT NULL` | FK -> `profiles.id` (Indexed) |
| `providerId` | `provider_id` | `UUID NULL` | FK -> `service_providers.id` (Indexed) |
| `categoryId` | `category_id` | `UUID NULL` | FK -> `service_categories.id` (Indexed) |
| `title` | `title` | `VARCHAR(200) NOT NULL` | Issue title |
| `description` | `description` | `TEXT NOT NULL` | Issue details |
| `priority` | `priority` | `maintenance_priority NOT NULL`| Default `MEDIUM` |
| `status` | `status` | `maintenance_status NOT NULL` | Default `OPEN` |
| `scheduledAt` | `scheduled_at` | `TIMESTAMPTZ NULL` | Work appointment schedule |
| `estimatedCost`| `estimated_cost` | `DECIMAL(12,2) NULL` | Pre-repair quote (`CHECK >= 0`) |
| `actualCost` | `actual_cost` | `DECIMAL(12,2) NULL` | Final billed cost (`CHECK >= 0`) |
| `completedAt` | `completed_at` | `TIMESTAMPTZ NULL` | Work completion timestamp |
| `createdAt` | `created_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |
| `updatedAt` | `updated_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |

### 14. `maintenance_updates`
Mapped to table: `maintenance_updates`
| Prisma Model Field | Database Column | Type / Nullability | Constraints & Notes |
| :--- | :--- | :--- | :--- |
| `id` | `id` | `UUID NOT NULL` | PK |
| `requestId` | `maintenance_request_id` | `UUID NOT NULL` | FK -> `maintenance_requests.id` (Indexed) |
| `authorId` | `added_by` | `UUID NOT NULL` | FK -> `profiles.id` (Indexed) |
| `message` | `note` | `TEXT NOT NULL` | Update note |
| `mediaUrl` | `media_url` | `TEXT NULL` | Optional photo attachment |
| `mediaType` | `media_type` | `VARCHAR(20) NULL` | Attachment media type |
| `createdAt` | `created_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |

### 15. `service_categories`
Mapped to table: `service_categories`
| Prisma Model Field | Database Column | Type / Nullability | Constraints & Notes |
| :--- | :--- | :--- | :--- |
| `id` | `id` | `UUID NOT NULL` | PK |
| `name` | `name` | `VARCHAR(100) NOT NULL` | Unique service category name |
| `description` | `description` | `TEXT NULL` | Description |
| `isActive` | `is_active` | `BOOLEAN NOT NULL` | Default `true` |
| `createdAt` | `created_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |

### 16. `service_providers`
Mapped to table: `service_providers`
| Prisma Model Field | Database Column | Type / Nullability | Constraints & Notes |
| :--- | :--- | :--- | :--- |
| `id` | `id` | `UUID NOT NULL` | PK |
| `profileId` | `profile_id` | `UUID NOT NULL` | Unique 1:1 FK -> `profiles.id` |
| `businessName` | `business_name` | `VARCHAR(150) NOT NULL` | Trade / business name |
| `bio` | `bio` | `TEXT NULL` | Provider credentials / bio |
| `serviceAreaCity` | `service_area_city` | `VARCHAR(100) NULL` | Operating city |
| `serviceAreaState`| `service_area_state` | `VARCHAR(100) NULL` | Operating state |
| `verificationStatus` | `verification_status`| `VARCHAR(30) NOT NULL` | Constrained (`PENDING`, `VERIFIED`, `REJECTED`) |
| `isAvailable` | `is_available` | `BOOLEAN NOT NULL` | Default `true` |
| `createdAt` | `created_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |
| `updatedAt` | `updated_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |

### 17. `service_provider_categories`
Mapped to table: `service_provider_categories`
| Prisma Model Field | Database Column | Type / Nullability | Constraints & Notes |
| :--- | :--- | :--- | :--- |
| `providerId` | `provider_id` | `UUID NOT NULL` | Composite PK (1/2), FK -> `service_providers.id` |
| `categoryId` | `category_id` | `UUID NOT NULL` | Composite PK (2/2), FK -> `service_categories.id` |

### 18. `favorites`
Mapped to table: `favorites`
| Prisma Model Field | Database Column | Type / Nullability | Constraints & Notes |
| :--- | :--- | :--- | :--- |
| `customerId` | `customer_id` | `UUID NOT NULL` | Composite PK (1/2), FK -> `profiles.id` |
| `spaceId` | `space_id` | `UUID NOT NULL` | Composite PK (2/2), FK -> `spaces.id` |
| `createdAt` | `created_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |

### 19. `space_reviews`
Mapped to table: `space_reviews`
| Prisma Model Field | Database Column | Type / Nullability | Constraints & Notes |
| :--- | :--- | :--- | :--- |
| `id` | `id` | `UUID NOT NULL` | PK |
| `bookingId` | `booking_id` | `UUID NOT NULL` | Unique FK -> `bookings.id` (1 review per booking) |
| `customerId` | `customer_id` | `UUID NOT NULL` | FK -> `profiles.id` (Indexed) |
| `spaceId` | `space_id` | `UUID NOT NULL` | FK -> `spaces.id` (Indexed) |
| `rating` | `rating` | `INTEGER NOT NULL` | Score 1–5 (`CHECK BETWEEN 1 AND 5`) |
| `comment` | `comment` | `TEXT NULL` | Review feedback |
| `createdAt` | `created_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |

### 20. `provider_reviews`
Mapped to table: `provider_reviews`
| Prisma Model Field | Database Column | Type / Nullability | Constraints & Notes |
| :--- | :--- | :--- | :--- |
| `id` | `id` | `UUID NOT NULL` | PK |
| `maintenanceRequestId` | `maintenance_request_id` | `UUID NOT NULL` | Unique FK -> `maintenance_requests.id` |
| `reviewerId` | `reviewer_id` | `UUID NOT NULL` | FK -> `profiles.id` (Indexed) |
| `providerId` | `provider_id` | `UUID NOT NULL` | FK -> `service_providers.id` (Indexed) |
| `rating` | `rating` | `INTEGER NOT NULL` | Score 1–5 (`CHECK BETWEEN 1 AND 5`) |
| `comment` | `comment` | `TEXT NULL` | Review feedback |
| `createdAt` | `created_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |

### 21. `notifications`
Mapped to table: `notifications`
| Prisma Model Field | Database Column | Type / Nullability | Constraints & Notes |
| :--- | :--- | :--- | :--- |
| `id` | `id` | `UUID NOT NULL` | PK |
| `userId` | `user_id` | `UUID NOT NULL` | FK -> `profiles.id` (Indexed) |
| `type` | `type` | `VARCHAR(50) NOT NULL` | Notification category |
| `title` | `title` | `VARCHAR(200) NOT NULL` | Notification headline |
| `message` | `message` | `TEXT NOT NULL` | Notification body |
| `readAt` | `read_at` | `TIMESTAMPTZ NULL` | Read timestamp (NULL = unread) |
| `linkUrl` | `link_url` | `TEXT NULL` | Added (Deep-link URL) |
| `createdAt` | `created_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |

### 22. `ai_conversations`
Mapped to table: `ai_conversations`
| Prisma Model Field | Database Column | Type / Nullability | Constraints & Notes |
| :--- | :--- | :--- | :--- |
| `id` | `id` | `UUID NOT NULL` | PK |
| `userId` | `user_id` | `UUID NOT NULL` | FK -> `profiles.id` (Indexed) |
| `title` | `title` | `VARCHAR(200) NULL` | Conversation summary |
| `createdAt` | `created_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |
| `updatedAt` | `updated_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |

### 23. `ai_messages`
Mapped to table: `ai_messages`
| Prisma Model Field | Database Column | Type / Nullability | Constraints & Notes |
| :--- | :--- | :--- | :--- |
| `id` | `id` | `UUID NOT NULL` | PK |
| `conversationId` | `conversation_id` | `UUID NOT NULL` | FK -> `ai_conversations.id` (Indexed) |
| `role` | `role` | `ai_message_role NOT NULL` | `USER`, `ASSISTANT`, `TOOL`, `SYSTEM` |
| `content` | `content` | `TEXT NOT NULL` | Message payload |
| `toolName` | `tool_name` | `VARCHAR(100) NULL` | Scoped tool name (for tool outputs) |
| `metadata` | `metadata` | `JSONB NULL` | Message metadata |
| `createdAt` | `created_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |

### 24. `ai_action_logs`
Mapped to table: `ai_action_logs`
| Prisma Model Field | Database Column | Type / Nullability | Constraints & Notes |
| :--- | :--- | :--- | :--- |
| `id` | `id` | `UUID NOT NULL` | PK |
| `userId` | `user_id` | `UUID NOT NULL` | FK -> `profiles.id` (Indexed) |
| `conversationId` | `conversation_id` | `UUID NULL` | FK -> `ai_conversations.id` (Indexed) |
| `action` | `action_name` | `VARCHAR(100) NOT NULL` | Scoped tool action invoked |
| `targetType` | `target_type` | `VARCHAR(50) NULL` | Entity type affected |
| `targetId` | `target_id` | `UUID NULL` | Entity UUID affected |
| `arguments` | `arguments` | `JSONB NULL` | Invocation parameters |
| `requiresConfirmation`| `confirmation_required`| `BOOLEAN NOT NULL` | Default `true` |
| `confirmedAt` | `confirmed_at` | `TIMESTAMPTZ NULL` | User approval timestamp |
| `status` | `status` | `ai_action_status NOT NULL`| Default `REQUESTED` ("Awaiting confirmation") |
| `result` | `result` | `JSONB NULL` | Action execution result |
| `errorDetails` | `error_details` | `JSONB NULL` | Failure diagnostics |
| `createdAt` | `created_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |

### 25. `media_assets` (Added Table)
Mapped to table: `media_assets`
| Prisma Model Field | Database Column | Type / Nullability | Constraints & Notes |
| :--- | :--- | :--- | :--- |
| `id` | `id` | `UUID NOT NULL` | PK, `default gen_random_uuid()` |
| `ownerType` | `owner_type` | `VARCHAR(50) NOT NULL` | Entity type (e.g. Property, Space, Profile) |
| `ownerId` | `owner_id` | `UUID NOT NULL` | Entity UUID (Composite indexed with `owner_type`) |
| `bucket` | `bucket` | `VARCHAR(100) NOT NULL` | Supabase Storage bucket |
| `storagePath` | `storage_path` | `VARCHAR(500) NOT NULL` | Storage object key |
| `mimeType` | `mime_type` | `VARCHAR(100) NOT NULL` | MIME type (e.g. `image/jpeg`) |
| `sizeBytes` | `size_bytes` | `INTEGER NOT NULL` | File byte size |
| `width` | `width` | `INTEGER NULL` | Image pixel width |
| `height` | `height` | `INTEGER NULL` | Image pixel height |
| `altText` | `alt_text` | `VARCHAR(255) NULL` | Accessibility alt text |
| `sortOrder` | `sort_order` | `INTEGER NOT NULL` | Default `0` |
| `uploadedBy` | `uploaded_by` | `UUID NOT NULL` | FK -> `profiles.id` (Indexed, `ON DELETE CASCADE`) |
| `createdAt` | `created_at` | `TIMESTAMPTZ NOT NULL` | Default `now()` |

### 26. `Users` (Legacy Table)
- **Status**: Kept in the database exactly as it is; marked with `@@ignore` in `schema.prisma`.
- **Purpose**: Preserves historical prototype schema without exposing user/password models to the Nexora application.
