-- CreateEnum
CREATE TYPE "ApiClientStatus" AS ENUM ('active', 'revoked');

-- CreateEnum
CREATE TYPE "LeadSourceKind" AS ENUM ('manual', 'import', 'web_form', 'app_dropoff', 'partner_referral', 'webhook', 'api');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('new', 'qualified', 'in_progress', 'on_hold', 'converted', 'won', 'lost', 'unqualified');

-- CreateEnum
CREATE TYPE "LeadUnqualifiedReason" AS ENUM ('junk', 'invalid_number', 'duplicate', 'not_interested', 'not_eligible', 'do_not_contact', 'test');

-- CreateEnum
CREATE TYPE "LeadLostReason" AS ENUM ('not_interested', 'not_eligible', 'went_elsewhere', 'unreachable', 'other');

-- CreateEnum
CREATE TYPE "LeadConsentStatus" AS ENUM ('pending', 'ok', 'withdrawn');

-- CreateEnum
CREATE TYPE "LeadFlag" AS ENUM ('duplicate', 'invalid_number', 'do_not_contact', 'test', 'spam', 'unmapped_location', 'unmapped_category');

-- CreateEnum
CREATE TYPE "LeadUrgency" AS ENUM ('immediate', 'within_month', 'exploring');

-- CreateEnum
CREATE TYPE "LeadEventType" AS ENUM ('captured', 'edited', 'status_changed', 'consent_changed', 'merged', 'contact_revealed');

-- CreateTable
CREATE TABLE "api_clients" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "scopes" TEXT[],
    "lead_source_id" UUID,
    "status" "ApiClientStatus" NOT NULL DEFAULT 'active',
    "created_by_user_id" UUID,
    "last_used_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "api_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_sources" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "LeadSourceKind" NOT NULL,
    "status" "CatalogStatus" NOT NULL DEFAULT 'active',
    "question_set_stage" TEXT,
    "consent_context" TEXT,
    "default_lawful_basis" "ConsentBasis",
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lead_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" UUID NOT NULL,
    "ref" TEXT NOT NULL,
    "party_id" UUID NOT NULL,
    "business_party_id" UUID,
    "source_id" UUID NOT NULL,
    "api_client_id" UUID,
    "captured_by_user_id" UUID,
    "campaign" TEXT,
    "utm" JSONB,
    "external_ref" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'new',
    "unqualified_reason" "LeadUnqualifiedReason",
    "lost_reason" "LeadLostReason",
    "status_note" TEXT,
    "status_changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hold_until" TIMESTAMPTZ(3),
    "segment_key" TEXT,
    "sub_segment_key" TEXT,
    "category_key" TEXT,
    "purpose_key" TEXT,
    "purpose_note" TEXT,
    "amount_min_paise" BIGINT,
    "amount_max_paise" BIGINT,
    "amount_text" TEXT,
    "tenure_months" INTEGER,
    "state_id" UUID,
    "city_id" UUID,
    "pincode" TEXT,
    "location_text" TEXT,
    "urgency" "LeadUrgency",
    "preferred_language" TEXT,
    "preferred_contact_time" TEXT,
    "quality_score" INTEGER NOT NULL DEFAULT 0,
    "flags" "LeadFlag"[],
    "consent_status" "LeadConsentStatus" NOT NULL DEFAULT 'pending',
    "lawful_basis" "ConsentBasis",
    "consent_evidence" TEXT,
    "duplicate_of_lead_id" UUID,
    "merged_into_lead_id" UUID,
    "import_batch_id" UUID,
    "import_row_number" INTEGER,
    "raw_payload_enc" TEXT,
    "converted_application_id" UUID,
    "converted_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_events" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "type" "LeadEventType" NOT NULL,
    "from_status" "LeadStatus",
    "to_status" "LeadStatus",
    "reason" TEXT,
    "note" TEXT,
    "actor_type" "ActorType" NOT NULL,
    "actor_user_id" UUID,
    "data" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_clients_key_prefix_key" ON "api_clients"("key_prefix");

-- CreateIndex
CREATE UNIQUE INDEX "lead_sources_key_key" ON "lead_sources"("key");

-- CreateIndex
CREATE UNIQUE INDEX "leads_ref_key" ON "leads"("ref");

-- CreateIndex
CREATE INDEX "leads_status_created_at_idx" ON "leads"("status", "created_at");

-- CreateIndex
CREATE INDEX "leads_party_id_idx" ON "leads"("party_id");

-- CreateIndex
CREATE INDEX "leads_consent_status_status_idx" ON "leads"("consent_status", "status");

-- CreateIndex
CREATE INDEX "leads_category_key_city_id_idx" ON "leads"("category_key", "city_id");

-- CreateIndex
CREATE INDEX "leads_pincode_idx" ON "leads"("pincode");

-- CreateIndex
CREATE INDEX "leads_import_batch_id_idx" ON "leads"("import_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "leads_source_id_external_ref_key" ON "leads"("source_id", "external_ref");

-- CreateIndex
CREATE INDEX "lead_events_lead_id_created_at_idx" ON "lead_events"("lead_id", "created_at");

-- AddForeignKey
ALTER TABLE "api_clients" ADD CONSTRAINT "api_clients_lead_source_id_fkey" FOREIGN KEY ("lead_source_id") REFERENCES "lead_sources"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_business_party_id_fkey" FOREIGN KEY ("business_party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "lead_sources"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_api_client_id_fkey" FOREIGN KEY ("api_client_id") REFERENCES "api_clients"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "geo_states"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "geo_cities"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_duplicate_of_lead_id_fkey" FOREIGN KEY ("duplicate_of_lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_merged_into_lead_id_fkey" FOREIGN KEY ("merged_into_lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lead_events" ADD CONSTRAINT "lead_events_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE SEQUENCE lead_ref_seq START 1;

CREATE TRIGGER lead_events_append_only
  BEFORE UPDATE OR DELETE ON lead_events
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

ALTER TABLE "leads" ADD CONSTRAINT "leads_amount_range"
  CHECK ("amount_min_paise" IS NULL OR "amount_max_paise" IS NULL OR "amount_min_paise" <= "amount_max_paise");

ALTER TABLE "leads" ADD CONSTRAINT "leads_amount_non_negative"
  CHECK (("amount_min_paise" IS NULL OR "amount_min_paise" >= 0) AND ("amount_max_paise" IS NULL OR "amount_max_paise" >= 0));

ALTER TABLE "leads" ADD CONSTRAINT "leads_pincode_format"
  CHECK ("pincode" IS NULL OR "pincode" ~ '^[1-9][0-9]{5}$');

ALTER TABLE "leads" ADD CONSTRAINT "leads_quality_score_range"
  CHECK ("quality_score" BETWEEN 0 AND 100);

ALTER TABLE "leads" ADD CONSTRAINT "leads_not_self_linked"
  CHECK ("duplicate_of_lead_id" IS DISTINCT FROM "id" AND "merged_into_lead_id" IS DISTINCT FROM "id");
