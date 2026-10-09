-- CreateEnum
CREATE TYPE "ConfigResource" AS ENUM ('question_set', 'routing_rule', 'consent_template', 'document_requirement', 'lender_product', 'scoring_model', 'improvement_rule', 'commission_scheme');

-- CreateEnum
CREATE TYPE "ConfigVersionStatus" AS ENUM ('draft', 'in_review', 'approved', 'published', 'retired');

-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'withdrawn');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('single_select', 'multi_select', 'number', 'money', 'date', 'text', 'boolean', 'city', 'pincode');

-- CreateEnum
CREATE TYPE "AnswerChannel" AS ENUM ('borrower', 'partner', 'ops', 'lead_source', 'import');

-- CreateTable
CREATE TABLE "config_documents" (
    "id" UUID NOT NULL,
    "resource" "ConfigResource" NOT NULL,
    "key" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB,
    "status" "CatalogStatus" NOT NULL DEFAULT 'active',
    "open_version_id" UUID,
    "latest_number" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "config_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_versions" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "ConfigVersionStatus" NOT NULL DEFAULT 'draft',
    "content" JSONB NOT NULL,
    "compiled" JSONB,
    "issues" JSONB,
    "content_hash" TEXT,
    "notes" TEXT,
    "effective_from" TIMESTAMPTZ(3),
    "published_at" TIMESTAMPTZ(3),
    "retired_at" TIMESTAMPTZ(3),
    "created_by_user_id" UUID,
    "submitted_by_user_id" UUID,
    "approved_by_user_id" UUID,
    "published_by_user_id" UUID,
    "retired_by_user_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "config_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_change_requests" (
    "id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "resource" "ConfigResource" NOT NULL,
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'pending',
    "maker_user_id" UUID NOT NULL,
    "checker_user_id" UUID,
    "reason" TEXT NOT NULL,
    "decision_note" TEXT,
    "diff" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMPTZ(3),

    CONSTRAINT "config_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "attribute_key" TEXT NOT NULL,
    "type" "QuestionType" NOT NULL,
    "label" JSONB NOT NULL,
    "help" JSONB,
    "options" JSONB,
    "validation" JSONB,
    "ui" JSONB,
    "status" "CatalogStatus" NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "question_set_version_id" UUID NOT NULL,
    "question_key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "fact_id" UUID,
    "channel" "AnswerChannel" NOT NULL,
    "answered_by_user_id" UUID,
    "lead_id" UUID,
    "application_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "config_documents_open_version_id_key" ON "config_documents"("open_version_id");

-- CreateIndex
CREATE INDEX "config_documents_resource_status_idx" ON "config_documents"("resource", "status");

-- CreateIndex
CREATE UNIQUE INDEX "config_documents_resource_key_key" ON "config_documents"("resource", "key");

-- CreateIndex
CREATE INDEX "config_versions_status_effective_from_idx" ON "config_versions"("status", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "config_versions_document_id_number_key" ON "config_versions"("document_id", "number");

-- CreateIndex
CREATE INDEX "config_change_requests_status_resource_idx" ON "config_change_requests"("status", "resource");

-- CreateIndex
CREATE INDEX "config_change_requests_version_id_idx" ON "config_change_requests"("version_id");

-- CreateIndex
CREATE UNIQUE INDEX "questions_key_key" ON "questions"("key");

-- CreateIndex
CREATE INDEX "questions_attribute_key_idx" ON "questions"("attribute_key");

-- CreateIndex
CREATE UNIQUE INDEX "answers_fact_id_key" ON "answers"("fact_id");

-- CreateIndex
CREATE INDEX "answers_party_id_question_key_created_at_idx" ON "answers"("party_id", "question_key", "created_at");

-- CreateIndex
CREATE INDEX "answers_lead_id_idx" ON "answers"("lead_id");

-- CreateIndex
CREATE INDEX "answers_application_id_idx" ON "answers"("application_id");

-- AddForeignKey
ALTER TABLE "config_versions" ADD CONSTRAINT "config_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "config_documents"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "config_change_requests" ADD CONSTRAINT "config_change_requests_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "config_versions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_attribute_key_fkey" FOREIGN KEY ("attribute_key") REFERENCES "attribute_definitions"("key") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_question_set_version_id_fkey" FOREIGN KEY ("question_set_version_id") REFERENCES "config_versions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_fact_id_fkey" FOREIGN KEY ("fact_id") REFERENCES "borrower_facts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE OR REPLACE FUNCTION immutable_except_party_id() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - 'party_id') IS DISTINCT FROM (to_jsonb(OLD) - 'party_id') THEN
    RAISE EXCEPTION 'table % is append-only', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER borrower_facts_immutable ON borrower_facts;
DROP FUNCTION borrower_facts_immutable();

CREATE TRIGGER borrower_facts_immutable
  BEFORE UPDATE ON borrower_facts
  FOR EACH ROW EXECUTE FUNCTION immutable_except_party_id();

CREATE TRIGGER answers_immutable
  BEFORE UPDATE ON answers
  FOR EACH ROW EXECUTE FUNCTION immutable_except_party_id();

CREATE OR REPLACE FUNCTION config_versions_freeze() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'retired' THEN
    RAISE EXCEPTION 'config version % is retired and final', OLD.id USING ERRCODE = 'restrict_violation';
  END IF;
  IF NEW.document_id IS DISTINCT FROM OLD.document_id OR NEW.number IS DISTINCT FROM OLD.number THEN
    RAISE EXCEPTION 'config version % cannot move', OLD.id USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD.status <> 'draft' AND (
    NEW.content IS DISTINCT FROM OLD.content
    OR NEW.compiled IS DISTINCT FROM OLD.compiled
    OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
  ) THEN
    RAISE EXCEPTION 'config version % is frozen', OLD.id USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER config_versions_freeze
  BEFORE UPDATE ON config_versions
  FOR EACH ROW EXECUTE FUNCTION config_versions_freeze();

CREATE TRIGGER config_versions_no_delete
  BEFORE DELETE ON config_versions
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE OR REPLACE FUNCTION config_change_requests_decide_once() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'change request % is already decided', OLD.id USING ERRCODE = 'restrict_violation';
  END IF;
  IF (to_jsonb(NEW) - ARRAY['status', 'checker_user_id', 'decision_note', 'decided_at']) IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['status', 'checker_user_id', 'decision_note', 'decided_at']) THEN
    RAISE EXCEPTION 'change request % can only be decided', OLD.id USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER config_change_requests_decide_once
  BEFORE UPDATE ON config_change_requests
  FOR EACH ROW EXECUTE FUNCTION config_change_requests_decide_once();

CREATE TRIGGER config_change_requests_no_delete
  BEFORE DELETE ON config_change_requests
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

ALTER TABLE "config_change_requests" ADD CONSTRAINT "config_change_requests_maker_is_not_checker"
  CHECK ("checker_user_id" IS NULL OR "checker_user_id" <> "maker_user_id");
