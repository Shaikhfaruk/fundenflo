-- CreateEnum
CREATE TYPE "ImportKind" AS ENUM ('leads');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('awaiting_upload', 'uploaded', 'mapped', 'validating', 'validated', 'committing', 'committed', 'undoing', 'undone', 'failed');

-- CreateEnum
CREATE TYPE "ImportRowStatus" AS ENUM ('valid', 'invalid', 'committed', 'failed', 'undone', 'kept');

-- AlterEnum
ALTER TYPE "LeadUnqualifiedReason" ADD VALUE 'import_undone';

-- CreateTable
CREATE TABLE "import_batches" (
    "id" UUID NOT NULL,
    "kind" "ImportKind" NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'awaiting_upload',
    "file_name" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "size_bytes" INTEGER,
    "columns" TEXT[],
    "sample_rows" JSONB,
    "mapping" JSONB,
    "defaults" JSONB,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "valid_rows" INTEGER NOT NULL DEFAULT 0,
    "invalid_rows" INTEGER NOT NULL DEFAULT 0,
    "committed_rows" INTEGER NOT NULL DEFAULT 0,
    "failed_rows" INTEGER NOT NULL DEFAULT 0,
    "undone_rows" INTEGER NOT NULL DEFAULT 0,
    "summary" JSONB,
    "error" TEXT,
    "created_by_user_id" UUID,
    "started_at" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_rows" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "status" "ImportRowStatus" NOT NULL,
    "raw_enc" TEXT NOT NULL,
    "errors" JSONB,
    "entity_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "import_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "import_batches_storage_key_key" ON "import_batches"("storage_key");

-- CreateIndex
CREATE INDEX "import_batches_kind_status_idx" ON "import_batches"("kind", "status");

-- CreateIndex
CREATE INDEX "import_rows_batch_id_status_idx" ON "import_rows"("batch_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "import_rows_batch_id_row_number_key" ON "import_rows"("batch_id", "row_number");

-- AddForeignKey
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE RESTRICT;
