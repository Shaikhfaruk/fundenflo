-- CreateEnum
CREATE TYPE "ConsentBasis" AS ENUM ('consent', 'legitimate_use');

-- CreateEnum
CREATE TYPE "ConsentChannel" AS ENUM ('app', 'web_form', 'partner_assisted', 'ops_call', 'import', 'sms_link', 'whatsapp_link', 'api');

-- CreateEnum
CREATE TYPE "ConsentScopeKind" AS ENUM ('none', 'organizations');

-- CreateTable
CREATE TABLE "consent_purposes" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" JSONB NOT NULL,
    "description" JSONB,
    "scope_kind" "ConsentScopeKind" NOT NULL DEFAULT 'none',
    "scope_organization_type" "OrganizationType",
    "allowed_bases" "ConsentBasis"[],
    "validity_days" INTEGER,
    "status" "CatalogStatus" NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "consent_purposes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "purpose_key" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "basis" "ConsentBasis" NOT NULL,
    "scope" JSONB,
    "template_version_id" UUID,
    "text_hash" TEXT,
    "locale" TEXT,
    "channel" "ConsentChannel" NOT NULL,
    "evidence" TEXT,
    "captured_by_user_id" UUID,
    "lead_id" UUID,
    "application_id" UUID,
    "ip" TEXT,
    "user_agent" TEXT,
    "client_recorded_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consent_purposes_key_key" ON "consent_purposes"("key");

-- CreateIndex
CREATE INDEX "consent_records_party_id_purpose_key_recorded_at_idx" ON "consent_records"("party_id", "purpose_key", "recorded_at");

-- CreateIndex
CREATE INDEX "consent_records_lead_id_idx" ON "consent_records"("lead_id");

-- CreateIndex
CREATE INDEX "consent_records_application_id_idx" ON "consent_records"("application_id");

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_purpose_key_fkey" FOREIGN KEY ("purpose_key") REFERENCES "consent_purposes"("key") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "config_versions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TRIGGER consent_records_immutable
  BEFORE UPDATE ON consent_records
  FOR EACH ROW EXECUTE FUNCTION immutable_except_party_id();

CREATE TRIGGER consent_records_no_delete
  BEFORE DELETE ON consent_records
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

ALTER TABLE "consent_purposes" ADD CONSTRAINT "consent_purposes_scope_type"
  CHECK (("scope_kind" = 'organizations') = ("scope_organization_type" IS NOT NULL));

ALTER TABLE "consent_purposes" ADD CONSTRAINT "consent_purposes_has_basis"
  CHECK (cardinality("allowed_bases") > 0);
