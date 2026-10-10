-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('draft', 'pre_screened', 'documents_pending', 'assessed', 'ready_for_submission', 'submitted', 'closed_won', 'closed_lost', 'withdrawn', 'expired');

-- CreateEnum
CREATE TYPE "ApplicationChannel" AS ENUM ('direct', 'partner', 'ops');

-- CreateEnum
CREATE TYPE "ApplicationEventType" AS ENUM ('created', 'requirement_changed', 'answers_recorded', 'status_changed', 'stage_changed', 'lead_linked', 'note');

-- CreateEnum
CREATE TYPE "BorrowerProfileStatus" AS ENUM ('active', 'archived');

-- CreateTable
CREATE TABLE "loan_applications" (
    "id" UUID NOT NULL,
    "ref" TEXT NOT NULL,
    "borrower_profile_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "acting_party_id" UUID NOT NULL,
    "channel" "ApplicationChannel" NOT NULL,
    "partner_organization_id" UUID,
    "lead_id" UUID,
    "segment_key" TEXT NOT NULL,
    "sub_segment_key" TEXT,
    "category_key" TEXT,
    "purpose_key" TEXT,
    "purpose_note" TEXT,
    "amount_paise" BIGINT,
    "tenure_months" INTEGER,
    "state_id" UUID,
    "city_id" UUID,
    "pincode" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'draft',
    "journey_stage" TEXT NOT NULL DEFAULT 'category',
    "pinned_versions" JSONB NOT NULL DEFAULT '{}',
    "assignee_user_id" UUID,
    "sla_due_at" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3),
    "close_reason" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "loan_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_events" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "type" "ApplicationEventType" NOT NULL,
    "from_status" "ApplicationStatus",
    "to_status" "ApplicationStatus",
    "reason" TEXT,
    "note" TEXT,
    "data" JSONB,
    "actor_type" "ActorType" NOT NULL,
    "actor_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrower_profiles" (
    "id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "acting_party_id" UUID NOT NULL,
    "segment_key" TEXT NOT NULL,
    "sub_segment_key" TEXT,
    "incorporated_on" DATE,
    "status" "BorrowerProfileStatus" NOT NULL DEFAULT 'active',
    "created_by_user_id" UUID NOT NULL,
    "partner_organization_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "borrower_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "loan_applications_ref_key" ON "loan_applications"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "loan_applications_lead_id_key" ON "loan_applications"("lead_id");

-- CreateIndex
CREATE INDEX "loan_applications_acting_party_id_status_idx" ON "loan_applications"("acting_party_id", "status");

-- CreateIndex
CREATE INDEX "loan_applications_party_id_idx" ON "loan_applications"("party_id");

-- CreateIndex
CREATE INDEX "loan_applications_partner_organization_id_status_idx" ON "loan_applications"("partner_organization_id", "status");

-- CreateIndex
CREATE INDEX "loan_applications_status_created_at_idx" ON "loan_applications"("status", "created_at");

-- CreateIndex
CREATE INDEX "application_events_application_id_created_at_idx" ON "application_events"("application_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "borrower_profiles_party_id_key" ON "borrower_profiles"("party_id");

-- CreateIndex
CREATE INDEX "borrower_profiles_acting_party_id_idx" ON "borrower_profiles"("acting_party_id");

-- CreateIndex
CREATE INDEX "borrower_profiles_partner_organization_id_idx" ON "borrower_profiles"("partner_organization_id");

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_borrower_profile_id_fkey" FOREIGN KEY ("borrower_profile_id") REFERENCES "borrower_profiles"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_acting_party_id_fkey" FOREIGN KEY ("acting_party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "borrower_profiles" ADD CONSTRAINT "borrower_profiles_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "borrower_profiles" ADD CONSTRAINT "borrower_profiles_acting_party_id_fkey" FOREIGN KEY ("acting_party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE SEQUENCE "application_ref_seq" START 1;

CREATE TRIGGER application_events_append_only
  BEFORE UPDATE OR DELETE ON application_events
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_amount_positive" CHECK ("amount_paise" IS NULL OR "amount_paise" > 0);

ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_tenure_range" CHECK ("tenure_months" IS NULL OR "tenure_months" BETWEEN 1 AND 480);

ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_pincode_format" CHECK ("pincode" IS NULL OR "pincode" ~ '^[1-9][0-9]{5}$');

ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_partner_channel" CHECK (("channel" = 'partner') = ("partner_organization_id" IS NOT NULL));

ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_closed_consistent" CHECK (("status" IN ('closed_won', 'closed_lost', 'withdrawn', 'expired')) = ("closed_at" IS NOT NULL));
