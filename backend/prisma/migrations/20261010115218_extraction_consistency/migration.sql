-- CreateEnum
CREATE TYPE "SignalSeverity" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "SignalStatus" AS ENUM ('open', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('extracted', 'needs_review', 'reviewed', 'failed');

-- CreateTable
CREATE TABLE "consistency_signals" (
    "id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "application_id" UUID,
    "attribute_key" TEXT NOT NULL,
    "declared_fact_id" UUID NOT NULL,
    "observed_fact_id" UUID NOT NULL,
    "observed_provenance" "FactProvenance" NOT NULL,
    "declared_value" JSONB NOT NULL,
    "observed_value" JSONB NOT NULL,
    "deviation_pct" DECIMAL(8,2),
    "severity" "SignalSeverity" NOT NULL,
    "status" "SignalStatus" NOT NULL DEFAULT 'open',
    "resolution_note" TEXT,
    "resolved_by_user_id" UUID,
    "resolved_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "consistency_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_extractions" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "extractor" TEXT NOT NULL,
    "model" TEXT,
    "prompt_version" TEXT,
    "status" "ExtractionStatus" NOT NULL,
    "classified_as" TEXT,
    "class_confidence" DECIMAL(4,3),
    "fields" JSONB NOT NULL DEFAULT '[]',
    "reason" TEXT,
    "reviewed_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_extractions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consistency_signals_party_id_status_idx" ON "consistency_signals"("party_id", "status");

-- CreateIndex
CREATE INDEX "consistency_signals_status_created_at_idx" ON "consistency_signals"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "consistency_signals_observed_fact_id_attribute_key_key" ON "consistency_signals"("observed_fact_id", "attribute_key");

-- CreateIndex
CREATE INDEX "document_extractions_document_id_created_at_idx" ON "document_extractions"("document_id", "created_at");

-- AddForeignKey
ALTER TABLE "consistency_signals" ADD CONSTRAINT "consistency_signals_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "document_extractions" ADD CONSTRAINT "document_extractions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TRIGGER document_extractions_append_only
  BEFORE UPDATE OR DELETE ON document_extractions
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

ALTER TABLE "document_extractions" ADD CONSTRAINT "document_extractions_confidence_range" CHECK ("class_confidence" IS NULL OR "class_confidence" BETWEEN 0 AND 1);

ALTER TABLE "consistency_signals" ADD CONSTRAINT "consistency_signals_resolved_consistent" CHECK (("status" = 'open') = ("resolved_at" IS NULL));
