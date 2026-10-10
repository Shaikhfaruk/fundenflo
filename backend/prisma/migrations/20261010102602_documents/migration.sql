-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('uploaded', 'scanning', 'scanned', 'classifying', 'extracting', 'verified', 'needs_review', 'rejected', 'expired', 'deleted', 'purged');

-- CreateEnum
CREATE TYPE "DocumentSource" AS ENUM ('upload', 'digilocker', 'account_aggregator', 'ops');

-- CreateEnum
CREATE TYPE "DocumentRejectReason" AS ENUM ('infected', 'wrong_document', 'illegible', 'outdated', 'other');

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "document_type_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "borrower_profile_id" UUID,
    "application_id" UUID,
    "partner_organization_id" UUID,
    "source" "DocumentSource" NOT NULL DEFAULT 'upload',
    "status" "DocumentStatus" NOT NULL DEFAULT 'uploaded',
    "storage_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "pages" INTEGER,
    "period_start" DATE,
    "period_end" DATE,
    "password_enc" TEXT,
    "scan_engine" TEXT,
    "scan_signature" TEXT,
    "scan_attempts" INTEGER NOT NULL DEFAULT 0,
    "scanned_at" TIMESTAMPTZ(3),
    "reject_reason" "DocumentRejectReason",
    "reject_note" TEXT,
    "fresh_until" TIMESTAMPTZ(3),
    "retention_until" TIMESTAMPTZ(3),
    "locked_at" TIMESTAMPTZ(3),
    "uploaded_by_user_id" UUID NOT NULL,
    "uploaded_context" "SessionContext" NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    "deleted_by_user_id" UUID,
    "storage_deleted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documents_storage_key_key" ON "documents"("storage_key");

-- CreateIndex
CREATE INDEX "documents_party_id_status_idx" ON "documents"("party_id", "status");

-- CreateIndex
CREATE INDEX "documents_party_id_sha256_idx" ON "documents"("party_id", "sha256");

-- CreateIndex
CREATE INDEX "documents_application_id_status_idx" ON "documents"("application_id", "status");

-- CreateIndex
CREATE INDEX "documents_borrower_profile_id_created_at_idx" ON "documents"("borrower_profile_id", "created_at");

-- CreateIndex
CREATE INDEX "documents_status_updated_at_idx" ON "documents"("status", "updated_at");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_borrower_profile_id_fkey" FOREIGN KEY ("borrower_profile_id") REFERENCES "borrower_profiles"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "documents" ADD CONSTRAINT "documents_size_range" CHECK ("size_bytes" > 0 AND "size_bytes" <= 52428800);

ALTER TABLE "documents" ADD CONSTRAINT "documents_sha256_format" CHECK ("sha256" ~ '^[0-9a-f]{64}$');

ALTER TABLE "documents" ADD CONSTRAINT "documents_pages_positive" CHECK ("pages" IS NULL OR "pages" > 0);

ALTER TABLE "documents" ADD CONSTRAINT "documents_period_order" CHECK ("period_start" IS NULL OR "period_end" IS NULL OR "period_start" <= "period_end");

ALTER TABLE "documents" ADD CONSTRAINT "documents_scan_attempts_non_negative" CHECK ("scan_attempts" >= 0);

ALTER TABLE "documents" ADD CONSTRAINT "documents_rejected_has_reason" CHECK ("status" <> 'rejected' OR "reject_reason" IS NOT NULL);

ALTER TABLE "documents" ADD CONSTRAINT "documents_removed_consistent" CHECK (("status" IN ('deleted', 'purged')) = ("deleted_at" IS NOT NULL));

ALTER TABLE "documents" ADD CONSTRAINT "documents_storage_removed_only_when_gone" CHECK ("storage_deleted_at" IS NULL OR "status" IN ('deleted', 'purged', 'rejected'));
