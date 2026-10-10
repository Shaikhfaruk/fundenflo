-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('queued', 'running', 'done', 'failed');

-- CreateEnum
CREATE TYPE "ScoreResultStatus" AS ENUM ('scored', 'insufficient');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('pending', 'sent', 'cancelled');

-- AlterTable
ALTER TABLE "loan_applications" ADD COLUMN     "latest_score_result_id" UUID,
ADD COLUMN     "scored_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "analyses" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'queued',
    "steps" JSONB NOT NULL DEFAULT '[]',
    "document_ids" UUID[],
    "requested_by_user_id" UUID NOT NULL,
    "score_result_id" UUID,
    "failure_reason" TEXT,
    "started_at" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_results" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "party_id" UUID NOT NULL,
    "model_document_id" UUID NOT NULL,
    "model_key" TEXT NOT NULL,
    "model_version_id" UUID NOT NULL,
    "model_number" INTEGER NOT NULL,
    "status" "ScoreResultStatus" NOT NULL,
    "value" INTEGER,
    "band" JSONB,
    "factors" JSONB NOT NULL,
    "limitations" JSONB NOT NULL,
    "inputs" JSONB NOT NULL,
    "consents" JSONB NOT NULL,
    "input_hash" TEXT NOT NULL,
    "computed_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "improvement_items" (
    "id" UUID NOT NULL,
    "score_result_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "rule_key" TEXT NOT NULL,
    "rule_version_id" UUID NOT NULL,
    "priority" INTEGER NOT NULL,
    "title" JSONB NOT NULL,
    "found" JSONB NOT NULL,
    "why" JSONB NOT NULL,
    "action" JSONB NOT NULL,
    "evidence" JSONB NOT NULL,
    "evidence_document_type" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "improvement_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'pending',
    "sent_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "notification_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "analyses_score_result_id_key" ON "analyses"("score_result_id");

-- CreateIndex
CREATE INDEX "analyses_application_id_created_at_idx" ON "analyses"("application_id", "created_at");

-- CreateIndex
CREATE INDEX "analyses_status_created_at_idx" ON "analyses"("status", "created_at");

-- CreateIndex
CREATE INDEX "score_results_application_id_created_at_idx" ON "score_results"("application_id", "created_at");

-- CreateIndex
CREATE INDEX "improvement_items_score_result_id_priority_idx" ON "improvement_items"("score_result_id", "priority");

-- CreateIndex
CREATE INDEX "notification_subscriptions_event_entity_id_status_idx" ON "notification_subscriptions"("event", "entity_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "notification_subscriptions_user_id_event_entity_id_channel_key" ON "notification_subscriptions"("user_id", "event", "entity_id", "channel");

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_score_result_id_fkey" FOREIGN KEY ("score_result_id") REFERENCES "score_results"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "score_results" ADD CONSTRAINT "score_results_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "improvement_items" ADD CONSTRAINT "improvement_items_score_result_id_fkey" FOREIGN KEY ("score_result_id") REFERENCES "score_results"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TRIGGER score_results_append_only
  BEFORE UPDATE OR DELETE ON score_results
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER improvement_items_append_only
  BEFORE UPDATE OR DELETE ON improvement_items
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

ALTER TABLE "score_results" ADD CONSTRAINT "score_results_value_range" CHECK ("value" IS NULL OR "value" BETWEEN 0 AND 100);

ALTER TABLE "score_results" ADD CONSTRAINT "score_results_status_value" CHECK (("status" = 'scored') = ("value" IS NOT NULL));

ALTER TABLE "analyses" ADD CONSTRAINT "analyses_finished_consistent" CHECK (("status" IN ('done', 'failed')) = ("finished_at" IS NOT NULL));

CREATE UNIQUE INDEX "analyses_one_open_per_application" ON "analyses" ("application_id") WHERE "status" IN ('queued', 'running');
