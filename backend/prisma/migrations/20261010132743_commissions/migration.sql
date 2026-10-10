-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('asset', 'liability', 'revenue', 'expense');

-- CreateEnum
CREATE TYPE "JournalKind" AS ENUM ('receivable_accrued', 'receivable_received', 'receivable_written_off', 'payout_accrued', 'payout_paid', 'payout_reversed');

-- CreateEnum
CREATE TYPE "ReceivableStatus" AS ENUM ('accrued', 'invoiced', 'received', 'reconciled', 'written_off');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('pending', 'approved', 'paid', 'reversed');

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LedgerAccountType" NOT NULL,
    "organization_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_journals" (
    "id" UUID NOT NULL,
    "kind" "JournalKind" NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" UUID NOT NULL,
    "memo" TEXT,
    "posted_by_user_id" UUID,
    "posted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_journals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "journal_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "debit_paise" BIGINT NOT NULL DEFAULT 0,
    "credit_paise" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receivables" (
    "id" UUID NOT NULL,
    "ref" TEXT NOT NULL,
    "source_event_id" UUID NOT NULL,
    "lender_id" UUID NOT NULL,
    "lender_organization_id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "scheme_document_id" UUID NOT NULL,
    "scheme_version_id" UUID NOT NULL,
    "base_paise" BIGINT NOT NULL,
    "fee_paise" BIGINT NOT NULL,
    "gst_rate_bps" INTEGER NOT NULL,
    "gst_paise" BIGINT NOT NULL,
    "total_paise" BIGINT NOT NULL,
    "received_paise" BIGINT NOT NULL DEFAULT 0,
    "status" "ReceivableStatus" NOT NULL DEFAULT 'accrued',
    "invoice_number" TEXT,
    "invoiced_at" TIMESTAMPTZ(3),
    "received_at" TIMESTAMPTZ(3),
    "utr" TEXT,
    "reconciled_at" TIMESTAMPTZ(3),
    "reconciliation_run_id" UUID,
    "written_off_at" TIMESTAMPTZ(3),
    "write_off_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "receivables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_payouts" (
    "id" UUID NOT NULL,
    "ref" TEXT NOT NULL,
    "receivable_id" UUID NOT NULL,
    "partner_organization_id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "attribution_id" UUID,
    "scheme_document_id" UUID NOT NULL,
    "scheme_version_id" UUID NOT NULL,
    "base_paise" BIGINT NOT NULL,
    "gross_paise" BIGINT NOT NULL,
    "tds_rate_bps" INTEGER NOT NULL,
    "tds_paise" BIGINT NOT NULL,
    "net_paise" BIGINT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'pending',
    "approved_by_user_id" UUID,
    "approved_at" TIMESTAMPTZ(3),
    "paid_by_user_id" UUID,
    "paid_at" TIMESTAMPTZ(3),
    "utr" TEXT,
    "reversed_at" TIMESTAMPTZ(3),
    "reverse_reason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "partner_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_runs" (
    "id" UUID NOT NULL,
    "lender_organization_id" UUID,
    "source" TEXT NOT NULL,
    "line_count" INTEGER NOT NULL,
    "matched_count" INTEGER NOT NULL,
    "total_paise" BIGINT NOT NULL,
    "matched_paise" BIGINT NOT NULL,
    "unmatched" JSONB NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reconciliation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_code_key" ON "ledger_accounts"("code");

-- CreateIndex
CREATE INDEX "ledger_accounts_organization_id_idx" ON "ledger_accounts"("organization_id");

-- CreateIndex
CREATE INDEX "ledger_journals_source_type_source_id_idx" ON "ledger_journals"("source_type", "source_id");

-- CreateIndex
CREATE INDEX "ledger_entries_account_id_created_at_idx" ON "ledger_entries"("account_id", "created_at");

-- CreateIndex
CREATE INDEX "ledger_entries_journal_id_idx" ON "ledger_entries"("journal_id");

-- CreateIndex
CREATE UNIQUE INDEX "receivables_ref_key" ON "receivables"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "receivables_source_event_id_key" ON "receivables"("source_event_id");

-- CreateIndex
CREATE INDEX "receivables_status_created_at_idx" ON "receivables"("status", "created_at");

-- CreateIndex
CREATE INDEX "receivables_lender_organization_id_status_idx" ON "receivables"("lender_organization_id", "status");

-- CreateIndex
CREATE INDEX "receivables_submission_id_idx" ON "receivables"("submission_id");

-- CreateIndex
CREATE UNIQUE INDEX "partner_payouts_ref_key" ON "partner_payouts"("ref");

-- CreateIndex
CREATE UNIQUE INDEX "partner_payouts_receivable_id_key" ON "partner_payouts"("receivable_id");

-- CreateIndex
CREATE INDEX "partner_payouts_partner_organization_id_status_idx" ON "partner_payouts"("partner_organization_id", "status");

-- CreateIndex
CREATE INDEX "partner_payouts_status_created_at_idx" ON "partner_payouts"("status", "created_at");

-- CreateIndex
CREATE INDEX "reconciliation_runs_created_at_idx" ON "reconciliation_runs"("created_at");

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "ledger_journals"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "partner_payouts" ADD CONSTRAINT "partner_payouts_receivable_id_fkey" FOREIGN KEY ("receivable_id") REFERENCES "receivables"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE SEQUENCE "receivable_ref_seq" START 1;

CREATE SEQUENCE "payout_ref_seq" START 1;

CREATE TRIGGER ledger_journals_append_only
  BEFORE UPDATE OR DELETE ON ledger_journals
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER ledger_entries_append_only
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER reconciliation_runs_append_only
  BEFORE UPDATE OR DELETE ON reconciliation_runs
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_one_side" CHECK (("debit_paise" > 0 AND "credit_paise" = 0) OR ("credit_paise" > 0 AND "debit_paise" = 0));

CREATE FUNCTION ledger_journal_balanced() RETURNS trigger AS $$
DECLARE
  difference bigint;
BEGIN
  SELECT COALESCE(SUM("debit_paise"), 0) - COALESCE(SUM("credit_paise"), 0) INTO difference FROM "ledger_entries" WHERE "journal_id" = NEW."journal_id";
  IF difference <> 0 THEN
    RAISE EXCEPTION 'ledger journal % is not balanced (difference %)', NEW."journal_id", difference USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER ledger_entries_balanced
  AFTER INSERT ON ledger_entries
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION ledger_journal_balanced();

ALTER TABLE "receivables" ADD CONSTRAINT "receivables_amounts" CHECK ("base_paise" > 0 AND "fee_paise" >= 0 AND "gst_paise" >= 0 AND "total_paise" = "fee_paise" + "gst_paise" AND "received_paise" >= 0 AND "received_paise" <= "total_paise");

ALTER TABLE "receivables" ADD CONSTRAINT "receivables_gst_rate" CHECK ("gst_rate_bps" BETWEEN 0 AND 10000);

ALTER TABLE "receivables" ADD CONSTRAINT "receivables_written_off_consistent" CHECK (("status" = 'written_off') = ("written_off_at" IS NOT NULL) AND ("written_off_at" IS NULL) = ("write_off_reason" IS NULL));

ALTER TABLE "receivables" ADD CONSTRAINT "receivables_invoice_present" CHECK ("status" <> 'invoiced' OR "invoice_number" IS NOT NULL);

ALTER TABLE "receivables" ADD CONSTRAINT "receivables_received_consistent" CHECK ("status" NOT IN ('received', 'reconciled') OR ("received_paise" = "total_paise" AND "received_at" IS NOT NULL));

ALTER TABLE "partner_payouts" ADD CONSTRAINT "partner_payouts_amounts" CHECK ("gross_paise" >= 0 AND "tds_paise" >= 0 AND "tds_paise" <= "gross_paise" AND "net_paise" = "gross_paise" - "tds_paise" AND "base_paise" >= 0);

ALTER TABLE "partner_payouts" ADD CONSTRAINT "partner_payouts_tds_rate" CHECK ("tds_rate_bps" BETWEEN 0 AND 10000);

ALTER TABLE "partner_payouts" ADD CONSTRAINT "partner_payouts_paid_consistent" CHECK (("status" = 'paid') = ("paid_at" IS NOT NULL AND "utr" IS NOT NULL));

ALTER TABLE "partner_payouts" ADD CONSTRAINT "partner_payouts_approved_consistent" CHECK ("status" NOT IN ('approved', 'paid') OR "approved_at" IS NOT NULL);

ALTER TABLE "partner_payouts" ADD CONSTRAINT "partner_payouts_two_people" CHECK ("paid_by_user_id" IS NULL OR "paid_by_user_id" <> "approved_by_user_id");

ALTER TABLE "partner_payouts" ADD CONSTRAINT "partner_payouts_reversed_consistent" CHECK (("status" = 'reversed') = ("reversed_at" IS NOT NULL));

ALTER TABLE "reconciliation_runs" ADD CONSTRAINT "reconciliation_runs_counts" CHECK ("line_count" >= 0 AND "matched_count" BETWEEN 0 AND "line_count" AND "matched_paise" BETWEEN 0 AND "total_paise");
