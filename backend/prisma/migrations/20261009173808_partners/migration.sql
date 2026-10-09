-- CreateEnum
CREATE TYPE "PartnerKind" AS ENUM ('ca', 'dsa', 'connector');

-- CreateEnum
CREATE TYPE "PartnerLevel" AS ENUM ('new', 'active', 'strategic');

-- CreateEnum
CREATE TYPE "PartnerVerificationStatus" AS ENUM ('pending', 'in_review', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "VerificationDecision" AS ENUM ('approve', 'reject');

-- CreateTable
CREATE TABLE "partner_profiles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "kind" "PartnerKind" NOT NULL,
    "level" "PartnerLevel" NOT NULL DEFAULT 'new',
    "verification_status" "PartnerVerificationStatus" NOT NULL DEFAULT 'pending',
    "membership_number" TEXT,
    "firm_registration_number" TEXT,
    "recommended_decision" "VerificationDecision",
    "recommended_by_user_id" UUID,
    "recommendation_note" TEXT,
    "recommended_at" TIMESTAMPTZ(3),
    "decided_by_user_id" UUID,
    "decision_note" TEXT,
    "decided_at" TIMESTAMPTZ(3),
    "segments" TEXT[],
    "categories" TEXT[],
    "languages" TEXT[],
    "max_open_leads" INTEGER,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "working_days" INTEGER[],
    "working_hours_start" TEXT,
    "working_hours_end" TEXT,
    "signed_up_by_user_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "partner_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_service_areas" (
    "id" UUID NOT NULL,
    "partner_profile_id" UUID NOT NULL,
    "state_id" UUID,
    "city_id" UUID,
    "pincode" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_service_areas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "partner_profiles_organization_id_key" ON "partner_profiles"("organization_id");

-- CreateIndex
CREATE INDEX "partner_profiles_verification_status_kind_idx" ON "partner_profiles"("verification_status", "kind");

-- CreateIndex
CREATE INDEX "partner_service_areas_partner_profile_id_idx" ON "partner_service_areas"("partner_profile_id");

-- CreateIndex
CREATE INDEX "partner_service_areas_state_id_idx" ON "partner_service_areas"("state_id");

-- CreateIndex
CREATE INDEX "partner_service_areas_city_id_idx" ON "partner_service_areas"("city_id");

-- CreateIndex
CREATE INDEX "partner_service_areas_pincode_idx" ON "partner_service_areas"("pincode");

-- AddForeignKey
ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "partner_service_areas" ADD CONSTRAINT "partner_service_areas_partner_profile_id_fkey" FOREIGN KEY ("partner_profile_id") REFERENCES "partner_profiles"("id") ON DELETE CASCADE ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "partner_service_areas" ADD CONSTRAINT "partner_service_areas_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "geo_states"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "partner_service_areas" ADD CONSTRAINT "partner_service_areas_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "geo_cities"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "partner_service_areas" ADD CONSTRAINT "partner_service_areas_one_target"
  CHECK (num_nonnulls("state_id", "city_id", "pincode") = 1);

ALTER TABLE "partner_service_areas" ADD CONSTRAINT "partner_service_areas_pincode_format"
  CHECK ("pincode" IS NULL OR "pincode" ~ '^[1-9][0-9]{5}$');

ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_capacity"
  CHECK ("max_open_leads" IS NULL OR "max_open_leads" >= 0);

ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_working_days"
  CHECK ("working_days" <@ ARRAY[1, 2, 3, 4, 5, 6, 7]);

ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_two_people"
  CHECK ("decided_by_user_id" IS NULL OR "recommended_by_user_id" IS NULL OR "decided_by_user_id" <> "recommended_by_user_id");
