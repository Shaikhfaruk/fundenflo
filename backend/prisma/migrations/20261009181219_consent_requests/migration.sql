-- CreateEnum
CREATE TYPE "ConsentRequestStatus" AS ENUM ('pending', 'completed', 'expired', 'cancelled');

-- CreateTable
CREATE TABLE "consent_requests" (
    "id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "lead_id" UUID,
    "template_version_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "channel" "ConsentChannel" NOT NULL,
    "recipient_masked" TEXT NOT NULL,
    "status" "ConsentRequestStatus" NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "consent_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consent_requests_token_hash_key" ON "consent_requests"("token_hash");

-- CreateIndex
CREATE INDEX "consent_requests_party_id_status_idx" ON "consent_requests"("party_id", "status");

-- CreateIndex
CREATE INDEX "consent_requests_lead_id_idx" ON "consent_requests"("lead_id");

-- AddForeignKey
ALTER TABLE "consent_requests" ADD CONSTRAINT "consent_requests_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "consent_requests" ADD CONSTRAINT "consent_requests_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "config_versions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;
