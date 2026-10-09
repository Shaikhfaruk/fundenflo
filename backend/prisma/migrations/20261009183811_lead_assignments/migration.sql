-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('offered', 'accepted', 'working', 'completed', 'declined', 'expired', 'revoked', 'returned');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadEventType" ADD VALUE 'routed';
ALTER TYPE "LeadEventType" ADD VALUE 'assignment_changed';

-- CreateTable
CREATE TABLE "lead_assignments" (
    "id" UUID NOT NULL,
    "lead_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "assignee_membership_id" UUID,
    "routing_rule_version_id" UUID,
    "strategy" TEXT NOT NULL,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'offered',
    "offered_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respond_by" TIMESTAMPTZ(3),
    "accepted_at" TIMESTAMPTZ(3),
    "first_contact_by" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3),
    "reason" TEXT,
    "note" TEXT,
    "assigned_by_user_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lead_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_assignments_organization_id_status_idx" ON "lead_assignments"("organization_id", "status");

-- CreateIndex
CREATE INDEX "lead_assignments_lead_id_status_idx" ON "lead_assignments"("lead_id", "status");

-- CreateIndex
CREATE INDEX "lead_assignments_status_respond_by_idx" ON "lead_assignments"("status", "respond_by");

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "lead_assignments" ADD CONSTRAINT "lead_assignments_routing_rule_version_id_fkey" FOREIGN KEY ("routing_rule_version_id") REFERENCES "config_versions"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE UNIQUE INDEX "lead_assignments_one_working_per_lead" ON "lead_assignments" ("lead_id") WHERE "status" IN ('accepted', 'working');
