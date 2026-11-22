-- AlterTable
ALTER TABLE "booking_status_history" ADD COLUMN     "from_status" "booking_status";

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "link_url" TEXT;

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "avatar_url" TEXT;

-- AlterTable
ALTER TABLE "property_media" ADD COLUMN     "is_cover" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "storage_path" VARCHAR(500);

-- AlterTable
ALTER TABLE "space_media" ADD COLUMN     "is_cover" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "storage_path" VARCHAR(500);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_type" VARCHAR(50) NOT NULL,
    "owner_id" UUID NOT NULL,
    "bucket" VARCHAR(100) NOT NULL,
    "storage_path" VARCHAR(500) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "alt_text" VARCHAR(255),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "uploaded_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_assets_uploaded_by_idx" ON "media_assets"("uploaded_by");

-- CreateIndex
CREATE INDEX "media_assets_owner_type_owner_id_idx" ON "media_assets"("owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "ai_action_logs_conversation_id_idx" ON "ai_action_logs"("conversation_id");

-- CreateIndex
CREATE INDEX "booking_status_history_booking_id_idx" ON "booking_status_history"("booking_id");

-- CreateIndex
CREATE INDEX "booking_status_history_changed_by_idx" ON "booking_status_history"("changed_by");

-- CreateIndex
CREATE INDEX "bookings_space_id_start_at_end_at_idx" ON "bookings"("space_id", "start_at", "end_at");

-- CreateIndex
CREATE INDEX "inspection_items_inspection_id_idx" ON "inspection_items"("inspection_id");

-- CreateIndex
CREATE INDEX "inspection_media_inspection_id_idx" ON "inspection_media"("inspection_id");

-- CreateIndex
CREATE INDEX "inspections_inspector_id_idx" ON "inspections"("inspector_id");

-- CreateIndex
CREATE INDEX "maintenance_requests_category_id_idx" ON "maintenance_requests"("category_id");

-- CreateIndex
CREATE INDEX "maintenance_requests_requested_by_idx" ON "maintenance_requests"("requested_by");

-- CreateIndex
CREATE INDEX "maintenance_requests_space_id_idx" ON "maintenance_requests"("space_id");

-- CreateIndex
CREATE INDEX "maintenance_updates_added_by_idx" ON "maintenance_updates"("added_by");

-- CreateIndex
CREATE INDEX "maintenance_updates_maintenance_request_id_idx" ON "maintenance_updates"("maintenance_request_id");

-- CreateIndex
CREATE INDEX "payments_booking_id_idx" ON "payments"("booking_id");

-- CreateIndex
CREATE INDEX "payments_payer_id_idx" ON "payments"("payer_id");

-- CreateIndex
CREATE INDEX "property_expenses_added_by_idx" ON "property_expenses"("added_by");

-- CreateIndex
CREATE INDEX "property_expenses_maintenance_request_id_idx" ON "property_expenses"("maintenance_request_id");

-- CreateIndex
CREATE INDEX "property_media_property_id_idx" ON "property_media"("property_id");

-- CreateIndex
CREATE INDEX "provider_reviews_provider_id_idx" ON "provider_reviews"("provider_id");

-- CreateIndex
CREATE INDEX "provider_reviews_reviewer_id_idx" ON "provider_reviews"("reviewer_id");

-- CreateIndex
CREATE INDEX "space_media_space_id_idx" ON "space_media"("space_id");

-- CreateIndex
CREATE INDEX "space_reviews_customer_id_idx" ON "space_reviews"("customer_id");

-- CreateIndex
CREATE INDEX "space_reviews_space_id_idx" ON "space_reviews"("space_id");

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;


-- ==========================================
-- IDEMPOTENT CHECK CONSTRAINTS
-- ==========================================

-- 1. space_reviews and provider_reviews: rating BETWEEN 1 AND 5
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'space_reviews_rating_check') THEN
    ALTER TABLE "space_reviews" ADD CONSTRAINT "space_reviews_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'provider_reviews_rating_check') THEN
    ALTER TABLE "provider_reviews" ADD CONSTRAINT "provider_reviews_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5);
  END IF;
END $$;

-- 2. inspections: overall_condition_score BETWEEN 0 AND 100
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inspections_condition_score_check') THEN
    ALTER TABLE "inspections" ADD CONSTRAINT "inspections_condition_score_check" CHECK ("overall_condition_score" IS NULL OR ("overall_condition_score" >= 0 AND "overall_condition_score" <= 100));
  END IF;
END $$;

-- 3. bookings: times, base_amount, platform_fee, owner_amount, tax_amount, total_amount, guest_count
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_valid_time') THEN
    ALTER TABLE "bookings" ADD CONSTRAINT "bookings_valid_time" CHECK ("end_at" > "start_at");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_valid_guest_count') THEN
    ALTER TABLE "bookings" ADD CONSTRAINT "bookings_valid_guest_count" CHECK ("guest_count" > 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_subtotal_check') THEN
    ALTER TABLE "bookings" ADD CONSTRAINT "bookings_subtotal_check" CHECK ("base_amount" >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_platform_fee_check') THEN
    ALTER TABLE "bookings" ADD CONSTRAINT "bookings_platform_fee_check" CHECK ("platform_fee" >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_owner_amount_check') THEN
    ALTER TABLE "bookings" ADD CONSTRAINT "bookings_owner_amount_check" CHECK ("owner_amount" >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_tax_amount_check') THEN
    ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tax_amount_check" CHECK ("tax_amount" >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_total_amount_check') THEN
    ALTER TABLE "bookings" ADD CONSTRAINT "bookings_total_amount_check" CHECK ("total_amount" >= 0);
  END IF;
END $$;

-- 4. payments: amount >= 0
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_amount_check') THEN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_check" CHECK ("amount" >= 0);
  END IF;
END $$;

-- 5. property_expenses: amount >= 0
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'property_expenses_amount_check') THEN
    ALTER TABLE "property_expenses" ADD CONSTRAINT "property_expenses_amount_check" CHECK ("amount" >= 0);
  END IF;
END $$;

-- 6. spaces: price_amount >= 0 and capacity > 0
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spaces_price_amount_check') THEN
    ALTER TABLE "spaces" ADD CONSTRAINT "spaces_price_amount_check" CHECK ("price_amount" >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'spaces_capacity_check') THEN
    ALTER TABLE "spaces" ADD CONSTRAINT "spaces_capacity_check" CHECK ("capacity" IS NULL OR "capacity" > 0);
  END IF;
END $$;

-- 7. maintenance_requests: estimated_cost and actual_cost null or >= 0
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'maintenance_requests_estimated_cost_check') THEN
    ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_estimated_cost_check" CHECK ("estimated_cost" IS NULL OR "estimated_cost" >= 0);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'maintenance_requests_actual_cost_check') THEN
    ALTER TABLE "maintenance_requests" ADD CONSTRAINT "maintenance_requests_actual_cost_check" CHECK ("actual_cost" IS NULL OR "actual_cost" >= 0);
  END IF;
END $$;

-- 8. String Enums checks (Decision 2)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_payment_method_check') THEN
    ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_method_check" CHECK ("payment_method" IN ('CARD', 'UPI', 'NET_BANKING', 'CASH', 'WALLET'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inspection_items_condition_check') THEN
    ALTER TABLE "inspection_items" ADD CONSTRAINT "inspection_items_condition_check" CHECK ("condition" IN ('EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'service_providers_verification_status_check') THEN
    ALTER TABLE "service_providers" ADD CONSTRAINT "service_providers_verification_status_check" CHECK ("verification_status" IN ('PENDING', 'VERIFIED', 'REJECTED'));
  END IF;
END $$;
