-- CreateEnum
CREATE TYPE "RiskSignalKind" AS ENUM ('duplicate_identity', 'identity_mismatch', 'inflow_mismatch', 'gst_itr_mismatch', 'doc_tamper', 'document_reuse', 'referral_pattern');

-- CreateEnum
CREATE TYPE "RiskSeverity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "RiskSignalStatus" AS ENUM ('open', 'confirmed', 'dismissed');

-- CreateEnum
CREATE TYPE "RiskSource" AS ENUM ('rule', 'ai', 'ops');

-- CreateEnum
CREATE TYPE "RiskSubjectType" AS ENUM ('party', 'application', 'partner_organization');

-- CreateEnum
CREATE TYPE "FraudReviewStatus" AS ENUM ('open', 'decided');

-- CreateEnum
CREATE TYPE "FraudDecision" AS ENUM ('confirmed', 'cleared');

-- AlterTable
ALTER TABLE "partner_profiles" ADD COLUMN     "bank_account_hash" TEXT;

-- CreateTable
CREATE TABLE "fraud_reviews" (
    "id" UUID NOT NULL,
    "subject_type" "RiskSubjectType" NOT NULL,
    "subject_id" UUID NOT NULL,
    "party_id" UUID,
    "application_id" UUID,
    "organization_id" UUID,
    "status" "FraudReviewStatus" NOT NULL DEFAULT 'open',
    "highest_severity" "RiskSeverity" NOT NULL,
    "decision" "FraudDecision",
    "note" TEXT,
    "decided_by_user_id" UUID,
    "decided_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "fraud_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_signals" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "kind" "RiskSignalKind" NOT NULL,
    "severity" "RiskSeverity" NOT NULL,
    "source" "RiskSource" NOT NULL,
    "rule_key" TEXT NOT NULL,
    "subject_type" "RiskSubjectType" NOT NULL,
    "subject_id" UUID NOT NULL,
    "party_id" UUID,
    "application_id" UUID,
    "organization_id" UUID,
    "evidence" JSONB NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "status" "RiskSignalStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "risk_signals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fraud_reviews_status_highest_severity_created_at_idx" ON "fraud_reviews"("status", "highest_severity", "created_at");

-- CreateIndex
CREATE INDEX "fraud_reviews_application_id_idx" ON "fraud_reviews"("application_id");

-- CreateIndex
CREATE INDEX "fraud_reviews_party_id_idx" ON "fraud_reviews"("party_id");

-- CreateIndex
CREATE INDEX "fraud_reviews_organization_id_idx" ON "fraud_reviews"("organization_id");

-- CreateIndex
CREATE INDEX "risk_signals_status_severity_created_at_idx" ON "risk_signals"("status", "severity", "created_at");

-- CreateIndex
CREATE INDEX "risk_signals_kind_status_idx" ON "risk_signals"("kind", "status");

-- CreateIndex
CREATE INDEX "risk_signals_application_id_idx" ON "risk_signals"("application_id");

-- CreateIndex
CREATE INDEX "risk_signals_party_id_idx" ON "risk_signals"("party_id");

-- CreateIndex
CREATE INDEX "documents_sha256_idx" ON "documents"("sha256");

-- AddForeignKey
ALTER TABLE "risk_signals" ADD CONSTRAINT "risk_signals_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "fraud_reviews"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE UNIQUE INDEX "fraud_reviews_one_open_per_subject" ON "fraud_reviews" ("subject_type", "subject_id") WHERE "status" = 'open';

CREATE UNIQUE INDEX "risk_signals_one_open_per_fingerprint" ON "risk_signals" ("fingerprint") WHERE "status" = 'open';

ALTER TABLE "fraud_reviews" ADD CONSTRAINT "fraud_reviews_decision_consistent" CHECK (("status" = 'decided') = ("decision" IS NOT NULL AND "decided_at" IS NOT NULL AND "decided_by_user_id" IS NOT NULL));

CREATE INDEX "partner_profiles_bank_account_hash_idx" ON "partner_profiles" ("bank_account_hash") WHERE "bank_account_hash" IS NOT NULL;

ALTER TABLE "partner_profiles" ADD CONSTRAINT "partner_profiles_bank_hash_needs_account" CHECK ("bank_account_hash" IS NULL OR "bank_account_enc" IS NOT NULL);
