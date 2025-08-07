-- CreateTable
CREATE TABLE "subscriber" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "platform_id" VARCHAR(255),
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(100),
    "email" VARCHAR(255),
    "push_subscription_token" JSONB,
    "phone" VARCHAR(50),
    "country" VARCHAR(100),
    "state" VARCHAR(100),
    "city" VARCHAR(100),
    "zip_code" VARCHAR(20),
    "ip_address" INET,
    "order_count" INTEGER NOT NULL DEFAULT 0,
    "total_spend" DECIMAL(12,2) NOT NULL,
    "last_order_value" DECIMAL(12,2) NOT NULL,
    "last_order_date" TIMESTAMPTZ(6),
    "custom_fields" JSONB,
    "tags" TEXT[],
    "is_email_optin" BOOLEAN NOT NULL DEFAULT false,
    "is_push_optin" BOOLEAN NOT NULL DEFAULT false,
    "is_sms_optin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "subscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "segment" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "subscriber_count" BIGINT NOT NULL DEFAULT 0,
    "query" TEXT,
    "last_synced_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "storeId" TEXT,

    CONSTRAINT "segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "segment_subscriber" (
    "id" TEXT NOT NULL,
    "segment_id" TEXT NOT NULL,
    "subscriber_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "segment_subscriber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "subscriber_store_id_idx" ON "subscriber"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscriber_store_id_email_key" ON "subscriber"("store_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "subscriber_store_id_phone_key" ON "subscriber"("store_id", "phone");

-- CreateIndex
CREATE INDEX "segment_store_id_idx" ON "segment"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "segment_subscriber_segment_id_subscriber_id_key" ON "segment_subscriber"("segment_id", "subscriber_id");
