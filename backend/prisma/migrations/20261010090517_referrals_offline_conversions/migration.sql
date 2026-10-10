-- CreateEnum
CREATE TYPE "OfflineConversionStatus" AS ENUM ('reported', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "AttributionKind" AS ENUM ('referral');

-- CreateTable
CREATE TABLE "offline_conversions" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "lender_name" TEXT NOT NULL,
    "lender_organization_id" UUID,
    "category_key" TEXT,
    "sanctioned_amount_paise" BIGINT NOT NULL,
    "disbursed_amount_paise" BIGINT,
    "sanctioned_on" DATE NOT NULL,
    "disbursed_on" DATE,
    "loan_account_ref" TEXT,
    "note" TEXT,
    "status" "OfflineConversionStatus" NOT NULL DEFAULT 'reported',
    "reported_by_user_id" UUID NOT NULL,
    "decided_by_user_id" UUID,
    "decided_at" TIMESTAMPTZ(3),
    "decision_note" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "offline_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_attributions" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "kind" "AttributionKind" NOT NULL,
    "protected_until" TIMESTAMPTZ(3) NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_attributions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "offline_conversions_status_created_at_idx" ON "offline_conversions"("status", "created_at");

-- CreateIndex
CREATE INDEX "offline_conversions_lead_id_idx" ON "offline_conversions"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "lead_attributions_lead_id_key" ON "lead_attributions"("lead_id");

-- CreateIndex
CREATE INDEX "lead_attributions_organization_id_created_at_idx" ON "lead_attributions"("organization_id", "created_at");

-- AddForeignKey
ALTER TABLE "offline_conversions" ADD CONSTRAINT "offline_conversions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "offline_conversions" ADD CONSTRAINT "offline_conversions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "lead_assignments"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "offline_conversions" ADD CONSTRAINT "offline_conversions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lead_attributions" ADD CONSTRAINT "lead_attributions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lead_attributions" ADD CONSTRAINT "lead_attributions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE UNIQUE INDEX "offline_conversions_one_reported_per_lead" ON "offline_conversions" ("lead_id") WHERE "status" = 'reported';

ALTER TABLE "offline_conversions" ADD CONSTRAINT "offline_conversions_amounts_positive" CHECK ("sanctioned_amount_paise" > 0 AND ("disbursed_amount_paise" IS NULL OR "disbursed_amount_paise" > 0));

ALTER TABLE "offline_conversions" ADD CONSTRAINT "offline_conversions_disbursal_after_sanction" CHECK ("disbursed_on" IS NULL OR "disbursed_on" >= "sanctioned_on");

ALTER TABLE "offline_conversions" ADD CONSTRAINT "offline_conversions_decision_consistent" CHECK (("status" = 'reported') = ("decided_at" IS NULL));

ALTER TABLE "offline_conversions" ADD CONSTRAINT "offline_conversions_reporter_not_decider" CHECK ("decided_by_user_id" IS NULL OR "decided_by_user_id" <> "reported_by_user_id");
