-- CreateEnum
CREATE TYPE "DataRequestKind" AS ENUM ('access', 'correction', 'erasure');

-- CreateEnum
CREATE TYPE "DataRequestStatus" AS ENUM ('received', 'in_progress', 'completed', 'rejected');

-- CreateTable
CREATE TABLE "data_subject_requests" (
    "id" UUID NOT NULL,
    "ref" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "kind" "DataRequestKind" NOT NULL,
    "status" "DataRequestStatus" NOT NULL DEFAULT 'received',
    "details" TEXT,
    "due_at" TIMESTAMPTZ(3) NOT NULL,
    "response" TEXT,
    "outcome" JSONB,
    "export_storage_key" TEXT,
    "export_expires_at" TIMESTAMPTZ(3),
    "handled_by_user_id" UUID,
    "completed_at" TIMESTAMPTZ(3),
    "rejected_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "data_subject_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "data_subject_requests_ref_key" ON "data_subject_requests"("ref");

-- CreateIndex
CREATE INDEX "data_subject_requests_status_due_at_idx" ON "data_subject_requests"("status", "due_at");

-- CreateIndex
CREATE INDEX "data_subject_requests_user_id_created_at_idx" ON "data_subject_requests"("user_id", "created_at");

CREATE SEQUENCE "data_request_ref_seq" START 1;

CREATE UNIQUE INDEX "data_subject_requests_one_open_per_kind" ON "data_subject_requests" ("user_id", "kind") WHERE "status" IN ('received', 'in_progress');

ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_completed_consistent" CHECK (("status" = 'completed') = ("completed_at" IS NOT NULL));

ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_rejected_consistent" CHECK (("status" = 'rejected') = ("rejected_reason" IS NOT NULL));

ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_export_consistent" CHECK (("export_storage_key" IS NULL) = ("export_expires_at" IS NULL));
