-- CreateEnum
CREATE TYPE "MatchOutcome" AS ENUM ('eligible', 'needs_info', 'ineligible');

-- AlterEnum
ALTER TYPE "ApplicationEventType" ADD VALUE 'match_recorded';

-- AlterTable
ALTER TABLE "loan_applications" ADD COLUMN     "latest_match_run_id" UUID,
ADD COLUMN     "matched_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "match_runs" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "score_result_id" UUID,
    "request" JSONB NOT NULL,
    "product_version_ids" UUID[],
    "eligible_count" INTEGER NOT NULL,
    "triggered_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_results" (
    "id" UUID NOT NULL,
    "match_run_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "lender_id" UUID NOT NULL,
    "product_document_id" UUID NOT NULL,
    "product_version_id" UUID NOT NULL,
    "product_key" TEXT NOT NULL,
    "product_name" JSONB NOT NULL,
    "outcome" "MatchOutcome" NOT NULL,
    "rank" INTEGER NOT NULL,
    "fit" INTEGER NOT NULL,
    "screen" JSONB NOT NULL,
    "hard" JSONB NOT NULL,
    "soft" JSONB NOT NULL,
    "reasons" JSONB NOT NULL,
    "missing_attributes" TEXT[],
    "documents_needed" TEXT[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_results_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "match_runs_application_id_created_at_idx" ON "match_runs"("application_id", "created_at");

-- CreateIndex
CREATE INDEX "match_results_application_id_outcome_idx" ON "match_results"("application_id", "outcome");

-- CreateIndex
CREATE UNIQUE INDEX "match_results_match_run_id_product_version_id_key" ON "match_results"("match_run_id", "product_version_id");

-- AddForeignKey
ALTER TABLE "match_runs" ADD CONSTRAINT "match_runs_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_match_run_id_fkey" FOREIGN KEY ("match_run_id") REFERENCES "match_runs"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE TRIGGER match_runs_append_only
  BEFORE UPDATE OR DELETE ON match_runs
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER match_results_append_only
  BEFORE UPDATE OR DELETE ON match_results
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

ALTER TABLE "match_results" ADD CONSTRAINT "match_results_fit_range" CHECK ("fit" BETWEEN 0 AND 100);
