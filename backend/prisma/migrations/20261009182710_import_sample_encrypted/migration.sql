/*
  Warnings:

  - You are about to drop the column `sample_rows` on the `import_batches` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "import_batches" DROP COLUMN "sample_rows",
ADD COLUMN     "sample_rows_enc" TEXT;
