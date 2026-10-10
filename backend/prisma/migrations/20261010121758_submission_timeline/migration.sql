-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApplicationEventType" ADD VALUE 'assigned';
ALTER TYPE "ApplicationEventType" ADD VALUE 'submission_recorded';
ALTER TYPE "ApplicationEventType" ADD VALUE 'document_requested';
