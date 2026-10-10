-- CreateEnum
CREATE TYPE "ApplicationPartyRole" AS ENUM ('borrower', 'applicant', 'co_applicant', 'guarantor', 'director');

-- CreateEnum
CREATE TYPE "ApplicationPartyStatus" AS ENUM ('active', 'removed');

-- CreateEnum
CREATE TYPE "ApplicationPartyConsent" AS ENUM ('pending', 'granted', 'declined');

-- AlterEnum
ALTER TYPE "OtpPurpose" ADD VALUE 'consent';

-- CreateTable
CREATE TABLE "application_parties" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "role" "ApplicationPartyRole" NOT NULL,
    "relationship" TEXT,
    "status" "ApplicationPartyStatus" NOT NULL DEFAULT 'active',
    "consent_status" "ApplicationPartyConsent" NOT NULL DEFAULT 'pending',
    "consented_at" TIMESTAMPTZ(3),
    "added_by_user_id" UUID NOT NULL,
    "removed_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "application_parties_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "application_parties_party_id_idx" ON "application_parties"("party_id");

-- CreateIndex
CREATE UNIQUE INDEX "application_parties_application_id_party_id_key" ON "application_parties"("application_id", "party_id");

-- AddForeignKey
ALTER TABLE "application_parties" ADD CONSTRAINT "application_parties_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "application_parties" ADD CONSTRAINT "application_parties_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "application_parties" ADD CONSTRAINT "application_parties_removed_consistent" CHECK (("status" = 'removed') = ("removed_at" IS NOT NULL));

ALTER TABLE "application_parties" ADD CONSTRAINT "application_parties_consented_consistent" CHECK (("consent_status" = 'pending') = ("consented_at" IS NULL));

CREATE UNIQUE INDEX "application_parties_one_borrower" ON "application_parties" ("application_id") WHERE "role" = 'borrower';

INSERT INTO "application_parties" ("id", "application_id", "party_id", "role", "added_by_user_id", "updated_at")
SELECT uuidv7(), a."id", a."party_id", 'borrower', a."created_by_user_id", CURRENT_TIMESTAMP FROM "loan_applications" a
ON CONFLICT DO NOTHING;

INSERT INTO "application_parties" ("id", "application_id", "party_id", "role", "added_by_user_id", "updated_at")
SELECT uuidv7(), a."id", a."acting_party_id", 'applicant', a."created_by_user_id", CURRENT_TIMESTAMP FROM "loan_applications" a WHERE a."acting_party_id" <> a."party_id"
ON CONFLICT DO NOTHING;
