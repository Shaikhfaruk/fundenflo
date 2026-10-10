-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('pending_approval', 'approved', 'sent_to_lender', 'under_review', 'query_raised', 'sanctioned', 'disbursed', 'rejected', 'withdrawn');

-- CreateEnum
CREATE TYPE "SubmissionEventType" AS ENUM ('requested', 'approved', 'sent', 'acknowledged', 'query_raised', 'query_answered', 'sanctioned', 'disbursed', 'rejected', 'withdrawn', 'document_requested', 'note');

-- CreateEnum
CREATE TYPE "DocumentRequestStatus" AS ENUM ('open', 'fulfilled', 'cancelled');

-- CreateTable
CREATE TABLE "lender_submissions" (
    "id" UUID NOT NULL,
    "ref" TEXT NOT NULL,
    "application_id" UUID NOT NULL,
    "lender_id" UUID NOT NULL,
    "lender_organization_id" UUID NOT NULL,
    "product_document_id" UUID NOT NULL,
    "product_version_id" UUID NOT NULL,
    "product_key" TEXT NOT NULL,
    "match_result_id" UUID NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'pending_approval',
    "requested_by_user_id" UUID NOT NULL,
    "approved_by_user_id" UUID,
    "approved_at" TIMESTAMPTZ(3),
    "sent_at" TIMESTAMPTZ(3),
    "lender_reference" TEXT,
    "sanctioned_amount_paise" BIGINT,
    "sanctioned_at" TIMESTAMPTZ(3),
    "sanction_letter_document_id" UUID,
    "disbursed_amount_paise" BIGINT NOT NULL DEFAULT 0,
    "disbursed_at" TIMESTAMPTZ(3),
    "rejection_reason" TEXT,
    "rejection_note" TEXT,
    "withdrawn_reason" TEXT,
    "closed_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lender_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_events" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "type" "SubmissionEventType" NOT NULL,
    "from_status" "SubmissionStatus",
    "to_status" "SubmissionStatus",
    "actor_type" "ActorType" NOT NULL,
    "actor_user_id" UUID,
    "actor_context" "SessionContext",
    "note" TEXT,
    "data" JSONB,
    "evidence_document_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_packets" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "snapshot" JSONB NOT NULL,
    "document_ids" UUID[],
    "hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submission_packets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_requests" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "submission_id" UUID,
    "requested_by_user_id" UUID NOT NULL,
    "requested_context" "SessionContext" NOT NULL,
    "document_types" TEXT[],
    "note" TEXT,
    "status" "DocumentRequestStatus" NOT NULL DEFAULT 'open',
    "due_at" TIMESTAMPTZ(3),
    "fulfilled_document_ids" UUID[],
    "fulfilled_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "document_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lender_submissions_ref_key" ON "lender_submissions"("ref");

-- CreateIndex
CREATE INDEX "lender_submissions_application_id_status_idx" ON "lender_submissions"("application_id", "status");

-- CreateIndex
CREATE INDEX "lender_submissions_lender_organization_id_status_idx" ON "lender_submissions"("lender_organization_id", "status");

-- CreateIndex
CREATE INDEX "submission_events_submission_id_created_at_idx" ON "submission_events"("submission_id", "created_at");

-- CreateIndex
CREATE INDEX "submission_packets_submission_id_created_at_idx" ON "submission_packets"("submission_id", "created_at");

-- CreateIndex
CREATE INDEX "document_requests_application_id_status_idx" ON "document_requests"("application_id", "status");

-- CreateIndex
CREATE INDEX "document_requests_submission_id_status_idx" ON "document_requests"("submission_id", "status");

-- AddForeignKey
ALTER TABLE "lender_submissions" ADD CONSTRAINT "lender_submissions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "submission_events" ADD CONSTRAINT "submission_events_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "lender_submissions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "submission_packets" ADD CONSTRAINT "submission_packets_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "lender_submissions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "lender_submissions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE SEQUENCE "submission_ref_seq" START 1;

CREATE TRIGGER submission_events_append_only
  BEFORE UPDATE OR DELETE ON submission_events
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER submission_packets_append_only
  BEFORE UPDATE OR DELETE ON submission_packets
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE UNIQUE INDEX "lender_submissions_one_open_per_product" ON "lender_submissions" ("application_id", "product_document_id") WHERE "status" NOT IN ('rejected', 'withdrawn');

ALTER TABLE "lender_submissions" ADD CONSTRAINT "lender_submissions_sanction_positive" CHECK ("sanctioned_amount_paise" IS NULL OR "sanctioned_amount_paise" > 0);

ALTER TABLE "lender_submissions" ADD CONSTRAINT "lender_submissions_disbursed_within_sanction" CHECK ("disbursed_amount_paise" >= 0 AND ("sanctioned_amount_paise" IS NULL OR "disbursed_amount_paise" <= "sanctioned_amount_paise"));

ALTER TABLE "lender_submissions" ADD CONSTRAINT "lender_submissions_sanction_consistent" CHECK (("status" IN ('sanctioned', 'disbursed')) <= ("sanctioned_amount_paise" IS NOT NULL));

ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_types_present" CHECK (cardinality("document_types") > 0);

ALTER TABLE "document_requests" ADD CONSTRAINT "document_requests_fulfilled_consistent" CHECK (("status" = 'fulfilled') = ("fulfilled_at" IS NOT NULL));
