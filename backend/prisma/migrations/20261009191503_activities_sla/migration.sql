-- CreateEnum
CREATE TYPE "ActivityEntityType" AS ENUM ('lead');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('call', 'meeting', 'whatsapp', 'email', 'sms', 'note');

-- CreateEnum
CREATE TYPE "ActivityOutcome" AS ENUM ('connected', 'no_answer', 'busy', 'wrong_number', 'call_back', 'switched_off');

-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('open', 'done', 'cancelled');

-- CreateEnum
CREATE TYPE "SlaTimerStatus" AS ENUM ('pending', 'satisfied', 'breached', 'cancelled');

-- AlterEnum
ALTER TYPE "LeadFlag" ADD VALUE 'first_contact_missed';

-- AlterTable
ALTER TABLE "lead_assignments" ADD COLUMN     "first_contact_minutes" INTEGER,
ADD COLUMN     "first_contacted_at" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL,
    "entity_type" "ActivityEntityType" NOT NULL,
    "entity_id" UUID NOT NULL,
    "organization_id" UUID,
    "type" "ActivityType" NOT NULL,
    "outcome" "ActivityOutcome",
    "body" TEXT,
    "contact_id" UUID,
    "duration_seconds" INTEGER,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "actor_membership_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" UUID NOT NULL,
    "entity_type" "ActivityEntityType" NOT NULL,
    "entity_id" UUID NOT NULL,
    "organization_id" UUID,
    "assignee_user_id" UUID NOT NULL,
    "assignee_membership_id" UUID,
    "due_at" TIMESTAMPTZ(3) NOT NULL,
    "note" TEXT NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'open',
    "done_at" TIMESTAMPTZ(3),
    "done_by_user_id" UUID,
    "outcome_note" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_timers" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "due_at" TIMESTAMPTZ(3) NOT NULL,
    "warn_at" TIMESTAMPTZ(3),
    "status" "SlaTimerStatus" NOT NULL DEFAULT 'pending',
    "warned_at" TIMESTAMPTZ(3),
    "satisfied_at" TIMESTAMPTZ(3),
    "breached_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sla_timers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activities_entity_type_entity_id_occurred_at_idx" ON "activities"("entity_type", "entity_id", "occurred_at");

-- CreateIndex
CREATE INDEX "activities_organization_id_occurred_at_idx" ON "activities"("organization_id", "occurred_at");

-- CreateIndex
CREATE INDEX "follow_ups_assignee_user_id_status_due_at_idx" ON "follow_ups"("assignee_user_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "follow_ups_organization_id_status_due_at_idx" ON "follow_ups"("organization_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "follow_ups_entity_type_entity_id_idx" ON "follow_ups"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "sla_timers_entity_type_entity_id_idx" ON "sla_timers"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "sla_timers_kind_status_due_at_idx" ON "sla_timers"("kind", "status", "due_at");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE UNIQUE INDEX "sla_timers_one_pending" ON "sla_timers" ("kind", "entity_id") WHERE "status" = 'pending';

ALTER TABLE "sla_timers" ADD CONSTRAINT "sla_timers_warn_before_due" CHECK ("warn_at" IS NULL OR "warn_at" <= "due_at");

ALTER TABLE "activities" ADD CONSTRAINT "activities_duration_non_negative" CHECK ("duration_seconds" IS NULL OR "duration_seconds" >= 0);

ALTER TABLE "activities" ADD CONSTRAINT "activities_outcome_only_for_calls" CHECK ("outcome" IS NULL OR "type" = 'call');

ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_first_contact_minutes_positive" CHECK ("first_contact_minutes" IS NULL OR "first_contact_minutes" > 0);

CREATE TRIGGER activities_no_update
  BEFORE UPDATE ON activities
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();
