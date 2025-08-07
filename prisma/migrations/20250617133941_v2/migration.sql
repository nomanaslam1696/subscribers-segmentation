/*
  Warnings:

  - You are about to drop the column `storeId` on the `segment` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "segment" DROP COLUMN "storeId",
ADD COLUMN     "conditions" JSONB,
ADD COLUMN     "created_by_user_id" TEXT,
ADD COLUMN     "estimated_count" BIGINT,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "is_dynamic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sync_frequency_hours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "tags" TEXT[];

-- AlterTable
ALTER TABLE "segment_subscriber" ADD COLUMN     "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "score" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "subscriber" ADD COLUMN     "average_order_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "customer_tier" VARCHAR(50),
ADD COLUMN     "days_since_last_order" INTEGER,
ADD COLUMN     "first_order_date" TIMESTAMPTZ(6),
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "last_seen_at" TIMESTAMPTZ(6),
ADD COLUMN     "lifecycle_stage" VARCHAR(50),
ADD COLUMN     "preferred_language" VARCHAR(10),
ADD COLUMN     "time_zone" VARCHAR(50),
ADD COLUMN     "unsubscribed_at" TIMESTAMPTZ(6),
ALTER COLUMN "total_spend" SET DEFAULT 0,
ALTER COLUMN "last_order_value" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "subscriber_engagement" (
    "id" TEXT NOT NULL,
    "subscriber_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "channel" VARCHAR(20) NOT NULL,
    "total_sent" INTEGER NOT NULL DEFAULT 0,
    "total_delivered" INTEGER NOT NULL DEFAULT 0,
    "total_opened" INTEGER NOT NULL DEFAULT 0,
    "total_clicked" INTEGER NOT NULL DEFAULT 0,
    "total_converted" INTEGER NOT NULL DEFAULT 0,
    "last_engagement_date" TIMESTAMPTZ(6),
    "engagement_score" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "preferred_send_hour" INTEGER,
    "preferred_send_day" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subscriber_engagement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscriber_engagement_store_id_idx" ON "subscriber_engagement"("store_id");

-- CreateIndex
CREATE INDEX "subscriber_engagement_subscriber_id_idx" ON "subscriber_engagement"("subscriber_id");

-- CreateIndex
CREATE INDEX "subscriber_engagement_store_id_channel_idx" ON "subscriber_engagement"("store_id", "channel");

-- CreateIndex
CREATE INDEX "subscriber_engagement_store_id_engagement_score_idx" ON "subscriber_engagement"("store_id", "engagement_score");

-- CreateIndex
CREATE INDEX "subscriber_engagement_last_engagement_date_idx" ON "subscriber_engagement"("last_engagement_date");

-- CreateIndex
CREATE UNIQUE INDEX "subscriber_engagement_subscriber_id_store_id_channel_key" ON "subscriber_engagement"("subscriber_id", "store_id", "channel");

-- CreateIndex
CREATE INDEX "segment_store_id_is_active_idx" ON "segment"("store_id", "is_active");

-- CreateIndex
CREATE INDEX "segment_store_id_is_default_idx" ON "segment"("store_id", "is_default");

-- CreateIndex
CREATE INDEX "segment_store_id_is_dynamic_idx" ON "segment"("store_id", "is_dynamic");

-- CreateIndex
CREATE INDEX "segment_store_id_last_synced_at_idx" ON "segment"("store_id", "last_synced_at");

-- CreateIndex
CREATE INDEX "segment_store_id_created_at_idx" ON "segment"("store_id", "created_at");

-- CreateIndex
CREATE INDEX "segment_store_id_subscriber_count_idx" ON "segment"("store_id", "subscriber_count");

-- CreateIndex
CREATE INDEX "segment_tags_idx" ON "segment" USING GIN ("tags");

-- CreateIndex
CREATE INDEX "segment_store_id_name_idx" ON "segment"("store_id", "name");

-- CreateIndex
CREATE INDEX "segment_subscriber_segment_id_idx" ON "segment_subscriber"("segment_id");

-- CreateIndex
CREATE INDEX "segment_subscriber_subscriber_id_idx" ON "segment_subscriber"("subscriber_id");

-- CreateIndex
CREATE INDEX "segment_subscriber_segment_id_is_active_idx" ON "segment_subscriber"("segment_id", "is_active");

-- CreateIndex
CREATE INDEX "segment_subscriber_segment_id_added_at_idx" ON "segment_subscriber"("segment_id", "added_at");

-- CreateIndex
CREATE INDEX "segment_subscriber_segment_id_score_idx" ON "segment_subscriber"("segment_id", "score");

-- CreateIndex
CREATE INDEX "segment_subscriber_subscriber_id_is_active_idx" ON "segment_subscriber"("subscriber_id", "is_active");

-- CreateIndex
CREATE INDEX "segment_subscriber_segment_id_is_active_score_idx" ON "segment_subscriber"("segment_id", "is_active", "score");

-- CreateIndex
CREATE INDEX "segment_subscriber_subscriber_id_is_active_added_at_idx" ON "segment_subscriber"("subscriber_id", "is_active", "added_at");

-- CreateIndex
CREATE INDEX "subscriber_store_id_is_active_idx" ON "subscriber"("store_id", "is_active");

-- CreateIndex
CREATE INDEX "subscriber_store_id_created_at_idx" ON "subscriber"("store_id", "created_at");

-- CreateIndex
CREATE INDEX "subscriber_store_id_updated_at_idx" ON "subscriber"("store_id", "updated_at");

-- CreateIndex
CREATE INDEX "subscriber_store_id_last_order_date_idx" ON "subscriber"("store_id", "last_order_date");

-- CreateIndex
CREATE INDEX "subscriber_store_id_total_spend_idx" ON "subscriber"("store_id", "total_spend");

-- CreateIndex
CREATE INDEX "subscriber_store_id_order_count_idx" ON "subscriber"("store_id", "order_count");

-- CreateIndex
CREATE INDEX "subscriber_store_id_is_email_optin_idx" ON "subscriber"("store_id", "is_email_optin");

-- CreateIndex
CREATE INDEX "subscriber_store_id_is_push_optin_idx" ON "subscriber"("store_id", "is_push_optin");

-- CreateIndex
CREATE INDEX "subscriber_store_id_is_sms_optin_idx" ON "subscriber"("store_id", "is_sms_optin");

-- CreateIndex
CREATE INDEX "subscriber_store_id_lifecycle_stage_idx" ON "subscriber"("store_id", "lifecycle_stage");

-- CreateIndex
CREATE INDEX "subscriber_store_id_customer_tier_idx" ON "subscriber"("store_id", "customer_tier");

-- CreateIndex
CREATE INDEX "subscriber_store_id_country_idx" ON "subscriber"("store_id", "country");

-- CreateIndex
CREATE INDEX "subscriber_store_id_state_idx" ON "subscriber"("store_id", "state");

-- CreateIndex
CREATE INDEX "subscriber_store_id_city_idx" ON "subscriber"("store_id", "city");

-- CreateIndex
CREATE INDEX "subscriber_store_id_is_active_total_spend_idx" ON "subscriber"("store_id", "is_active", "total_spend");

-- CreateIndex
CREATE INDEX "subscriber_store_id_is_active_order_count_idx" ON "subscriber"("store_id", "is_active", "order_count");

-- CreateIndex
CREATE INDEX "subscriber_store_id_is_active_last_order_date_idx" ON "subscriber"("store_id", "is_active", "last_order_date");

-- CreateIndex
CREATE INDEX "subscriber_store_id_is_email_optin_is_active_idx" ON "subscriber"("store_id", "is_email_optin", "is_active");

-- CreateIndex
CREATE INDEX "subscriber_store_id_is_push_optin_is_active_idx" ON "subscriber"("store_id", "is_push_optin", "is_active");

-- CreateIndex
CREATE INDEX "subscriber_store_id_lifecycle_stage_is_active_idx" ON "subscriber"("store_id", "lifecycle_stage", "is_active");

-- CreateIndex
CREATE INDEX "subscriber_store_id_customer_tier_total_spend_idx" ON "subscriber"("store_id", "customer_tier", "total_spend");

-- CreateIndex
CREATE INDEX "subscriber_store_id_country_state_city_idx" ON "subscriber"("store_id", "country", "state", "city");

-- CreateIndex
CREATE INDEX "subscriber_store_id_first_name_last_name_idx" ON "subscriber"("store_id", "first_name", "last_name");

-- CreateIndex
CREATE INDEX "subscriber_tags_idx" ON "subscriber" USING GIN ("tags");

-- AddForeignKey
ALTER TABLE "segment_subscriber" ADD CONSTRAINT "segment_subscriber_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "segment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "segment_subscriber" ADD CONSTRAINT "segment_subscriber_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "subscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriber_engagement" ADD CONSTRAINT "subscriber_engagement_subscriber_id_fkey" FOREIGN KEY ("subscriber_id") REFERENCES "subscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;
