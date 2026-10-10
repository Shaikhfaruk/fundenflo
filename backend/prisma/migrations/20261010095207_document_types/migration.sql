-- CreateTable
CREATE TABLE "document_types" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" JSONB NOT NULL,
    "description" JSONB,
    "icon" TEXT,
    "accepted_mime_types" TEXT[],
    "max_size_bytes" INTEGER NOT NULL,
    "period_rule" TEXT,
    "freshness_days" INTEGER,
    "extractor_key" TEXT,
    "produces_attributes" TEXT[],
    "retention_days" INTEGER,
    "sensitivity" "DataSensitivity" NOT NULL,
    "status" "CatalogStatus" NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "document_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_types_key_key" ON "document_types"("key");

-- CreateIndex
CREATE INDEX "document_types_status_idx" ON "document_types"("status");

ALTER TABLE "document_types" ADD CONSTRAINT "document_types_size_range" CHECK ("max_size_bytes" > 0 AND "max_size_bytes" <= 52428800);

ALTER TABLE "document_types" ADD CONSTRAINT "document_types_positive_days" CHECK (("freshness_days" IS NULL OR "freshness_days" > 0) AND ("retention_days" IS NULL OR "retention_days" > 0));

ALTER TABLE "document_types" ADD CONSTRAINT "document_types_mime_types" CHECK (cardinality("accepted_mime_types") > 0);
