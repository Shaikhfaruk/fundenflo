-- CreateEnum
CREATE TYPE "AttributeDataType" AS ENUM ('integer', 'decimal', 'money', 'boolean', 'enum', 'string', 'date', 'percentage');

-- CreateEnum
CREATE TYPE "AttributeSubject" AS ENUM ('person', 'business', 'any');

-- CreateEnum
CREATE TYPE "DataSensitivity" AS ENUM ('public', 'personal', 'financial', 'special');

-- CreateEnum
CREATE TYPE "FactProvenance" AS ENUM ('declared', 'extracted', 'third_party_verified', 'ops_verified', 'derived');

-- CreateTable
CREATE TABLE "attribute_definitions" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" JSONB NOT NULL,
    "description" JSONB,
    "data_type" "AttributeDataType" NOT NULL,
    "unit" TEXT,
    "enum_values" JSONB,
    "subject" "AttributeSubject" NOT NULL,
    "sensitivity" "DataSensitivity" NOT NULL,
    "allowed_provenance" "FactProvenance"[],
    "freshness_days" INTEGER,
    "status" "CatalogStatus" NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "attribute_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrower_facts" (
    "id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "attribute_key" TEXT NOT NULL,
    "lead_id" UUID,
    "application_id" UUID,
    "value_json" JSONB,
    "value_enc" TEXT,
    "value_min" DECIMAL(24,4),
    "value_max" DECIMAL(24,4),
    "provenance" "FactProvenance" NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" TEXT,
    "confidence" DECIMAL(4,3),
    "observed_at" TIMESTAMPTZ(3) NOT NULL,
    "valid_until" TIMESTAMPTZ(3),
    "recorded_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "borrower_facts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attribute_definitions_key_key" ON "attribute_definitions"("key");

-- CreateIndex
CREATE INDEX "attribute_definitions_status_idx" ON "attribute_definitions"("status");

-- CreateIndex
CREATE INDEX "borrower_facts_party_id_attribute_key_observed_at_idx" ON "borrower_facts"("party_id", "attribute_key", "observed_at");

-- CreateIndex
CREATE INDEX "borrower_facts_lead_id_idx" ON "borrower_facts"("lead_id");

-- CreateIndex
CREATE INDEX "borrower_facts_application_id_idx" ON "borrower_facts"("application_id");

-- AddForeignKey
ALTER TABLE "borrower_facts" ADD CONSTRAINT "borrower_facts_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "borrower_facts" ADD CONSTRAINT "borrower_facts_attribute_key_fkey" FOREIGN KEY ("attribute_key") REFERENCES "attribute_definitions"("key") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE OR REPLACE FUNCTION borrower_facts_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - 'party_id') IS DISTINCT FROM (to_jsonb(OLD) - 'party_id') THEN
    RAISE EXCEPTION 'table % is append-only', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER borrower_facts_immutable
  BEFORE UPDATE ON borrower_facts
  FOR EACH ROW EXECUTE FUNCTION borrower_facts_immutable();

ALTER TABLE "borrower_facts" ADD CONSTRAINT "borrower_facts_value_present"
  CHECK (num_nonnulls("value_json", "value_enc") = 1);

ALTER TABLE "borrower_facts" ADD CONSTRAINT "borrower_facts_confidence_range"
  CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1));
