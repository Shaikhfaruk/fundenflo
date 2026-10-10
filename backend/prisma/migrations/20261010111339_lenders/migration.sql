-- CreateEnum
CREATE TYPE "LenderKind" AS ENUM ('bank', 'nbfc', 'hfc', 'small_finance_bank', 'cooperative_bank', 'fintech');

-- CreateEnum
CREATE TYPE "LenderStatus" AS ENUM ('onboarding', 'active', 'paused', 'offboarded');

-- CreateEnum
CREATE TYPE "LenderAgreementStatus" AS ENUM ('draft', 'active', 'expired', 'terminated');

-- CreateEnum
CREATE TYPE "LenderContactRole" AS ENUM ('relationship', 'credit', 'operations', 'escalation');

-- CreateTable
CREATE TABLE "lenders" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "kind" "LenderKind" NOT NULL,
    "rbi_registration_no" TEXT,
    "status" "LenderStatus" NOT NULL DEFAULT 'onboarding',
    "website" TEXT,
    "response_sla_hours" INTEGER,
    "notes" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lenders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lender_agreements" (
    "id" UUID NOT NULL,
    "lender_id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "LenderAgreementStatus" NOT NULL DEFAULT 'draft',
    "valid_from" DATE NOT NULL,
    "valid_to" DATE,
    "commission_note" TEXT,
    "commission_scheme_key" TEXT,
    "document_id" UUID,
    "activated_at" TIMESTAMPTZ(3),
    "terminated_at" TIMESTAMPTZ(3),
    "termination_reason" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lender_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lender_contacts" (
    "id" UUID NOT NULL,
    "lender_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "role" "LenderContactRole" NOT NULL,
    "email_enc" TEXT,
    "email_masked" TEXT,
    "mobile_enc" TEXT,
    "mobile_masked" TEXT,
    "escalation_level" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lender_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lenders_organization_id_key" ON "lenders"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "lenders_key_key" ON "lenders"("key");

-- CreateIndex
CREATE INDEX "lenders_status_idx" ON "lenders"("status");

-- CreateIndex
CREATE INDEX "lender_agreements_lender_id_status_idx" ON "lender_agreements"("lender_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "lender_agreements_lender_id_reference_key" ON "lender_agreements"("lender_id", "reference");

-- CreateIndex
CREATE INDEX "lender_contacts_lender_id_active_idx" ON "lender_contacts"("lender_id", "active");

-- AddForeignKey
ALTER TABLE "lenders" ADD CONSTRAINT "lenders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lender_agreements" ADD CONSTRAINT "lender_agreements_lender_id_fkey" FOREIGN KEY ("lender_id") REFERENCES "lenders"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lender_agreements" ADD CONSTRAINT "lender_agreements_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lender_contacts" ADD CONSTRAINT "lender_contacts_lender_id_fkey" FOREIGN KEY ("lender_id") REFERENCES "lenders"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "lenders" ADD CONSTRAINT "lenders_key_format" CHECK ("key" ~ '^[a-z][a-z0-9_]{1,39}$');

ALTER TABLE "lenders" ADD CONSTRAINT "lenders_response_sla_positive" CHECK ("response_sla_hours" IS NULL OR "response_sla_hours" BETWEEN 1 AND 720);

ALTER TABLE "lender_agreements" ADD CONSTRAINT "lender_agreements_validity_order" CHECK ("valid_to" IS NULL OR "valid_to" >= "valid_from");

ALTER TABLE "lender_agreements" ADD CONSTRAINT "lender_agreements_terminated_consistent" CHECK (("status" = 'terminated') = ("terminated_at" IS NOT NULL));

ALTER TABLE "lender_contacts" ADD CONSTRAINT "lender_contacts_reachable" CHECK ("email_enc" IS NOT NULL OR "mobile_enc" IS NOT NULL);

ALTER TABLE "lender_contacts" ADD CONSTRAINT "lender_contacts_escalation_range" CHECK ("escalation_level" BETWEEN 1 AND 3);
