-- CreateEnum
CREATE TYPE "PartnerKycStatus" AS ENUM ('not_started', 'pending', 'verified');

-- CreateEnum
CREATE TYPE "ReferralCodeStatus" AS ENUM ('active', 'disabled');

-- CreateEnum
CREATE TYPE "DisputeSource" AS ENUM ('signup_code', 'partner_claim');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('open', 'resolved');

-- CreateEnum
CREATE TYPE "DisputeOutcome" AS ENUM ('keep_holder', 'transfer', 'void');

-- AlterEnum
ALTER TYPE "AttributionKind" ADD VALUE 'referral_code';

-- AlterTable
ALTER TABLE "lead_attributions" ADD COLUMN     "disputed_at" TIMESTAMPTZ(3),
ADD COLUMN     "end_reason" TEXT,
ADD COLUMN     "ended_at" TIMESTAMPTZ(3),
ADD COLUMN     "referral_code_id" UUID,
ADD COLUMN     "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "created_by_user_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "partner_profiles" ADD COLUMN     "bank_account_enc" TEXT,
ADD COLUMN     "bank_account_last4" TEXT,
ADD COLUMN     "bank_ifsc" TEXT,
ADD COLUMN     "bank_updated_at" TIMESTAMPTZ(3),
ADD COLUMN     "kyc_status" "PartnerKycStatus" NOT NULL DEFAULT 'not_started',
ADD COLUMN     "kyc_verified_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "referral_codes" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "organization_id" UUID NOT NULL,
    "membership_id" UUID,
    "status" "ReferralCodeStatus" NOT NULL DEFAULT 'active',
    "disabled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribution_disputes" (
    "id" UUID NOT NULL,
    "attribution_id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "holder_organization_id" UUID NOT NULL,
    "claimant_organization_id" UUID NOT NULL,
    "source" "DisputeSource" NOT NULL,
    "referral_code_id" UUID,
    "claim_note" TEXT,
    "raised_by_user_id" UUID,
    "status" "DisputeStatus" NOT NULL DEFAULT 'open',
    "outcome" "DisputeOutcome",
    "resolution_note" TEXT,
    "resolved_by_user_id" UUID,
    "resolved_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "attribution_disputes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "referral_codes_code_key" ON "referral_codes"("code");

-- CreateIndex
CREATE INDEX "referral_codes_organization_id_status_idx" ON "referral_codes"("organization_id", "status");

-- CreateIndex
CREATE INDEX "attribution_disputes_status_created_at_idx" ON "attribution_disputes"("status", "created_at");

-- CreateIndex
CREATE INDEX "attribution_disputes_claimant_organization_id_status_idx" ON "attribution_disputes"("claimant_organization_id", "status");

-- AddForeignKey
ALTER TABLE "lead_attributions" ADD CONSTRAINT "lead_attributions_referral_code_id_fkey" FOREIGN KEY ("referral_code_id") REFERENCES "referral_codes"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "attribution_disputes" ADD CONSTRAINT "attribution_disputes_attribution_id_fkey" FOREIGN KEY ("attribution_id") REFERENCES "lead_attributions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_code_format" CHECK ("code" ~ '^[A-Z0-9]{6,12}$');

ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_disabled_consistent" CHECK (("status" = 'disabled') = ("disabled_at" IS NOT NULL));

CREATE UNIQUE INDEX "referral_codes_one_active_per_holder" ON "referral_codes" ("organization_id", COALESCE("membership_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "status" = 'active';

ALTER TABLE "lead_attributions" ADD CONSTRAINT "lead_attributions_end_consistent" CHECK (("ended_at" IS NULL) = ("end_reason" IS NULL));

ALTER TABLE "lead_attributions" ADD CONSTRAINT "lead_attributions_code_kind" CHECK (("kind" = 'referral_code') = ("referral_code_id" IS NOT NULL));

ALTER TABLE "attribution_disputes" ADD CONSTRAINT "attribution_disputes_distinct_parties" CHECK ("holder_organization_id" <> "claimant_organization_id");

ALTER TABLE "attribution_disputes" ADD CONSTRAINT "attribution_disputes_resolution_consistent" CHECK (("status" = 'resolved') = ("outcome" IS NOT NULL AND "resolved_at" IS NOT NULL));

CREATE UNIQUE INDEX "attribution_disputes_one_open_per_claimant" ON "attribution_disputes" ("attribution_id", "claimant_organization_id") WHERE "status" = 'open';

ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_kyc_verified_consistent" CHECK (("kyc_status" = 'verified') = ("kyc_verified_at" IS NOT NULL));

ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_bank_consistent" CHECK (("bank_account_enc" IS NULL) = ("bank_account_last4" IS NULL) AND ("bank_account_enc" IS NULL) = ("bank_ifsc" IS NULL));

ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_kyc_needs_bank" CHECK ("kyc_status" <> 'verified' OR "bank_account_enc" IS NOT NULL);
