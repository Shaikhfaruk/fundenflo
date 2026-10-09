-- CreateEnum
CREATE TYPE "CatalogStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "GeoStateKind" AS ENUM ('state', 'union_territory');

-- CreateEnum
CREATE TYPE "AliasKind" AS ENUM ('city', 'state', 'category');

-- CreateTable
CREATE TABLE "segments" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" JSONB NOT NULL,
    "description" JSONB,
    "icon" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "CatalogStatus" NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_segments" (
    "id" UUID NOT NULL,
    "segment_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" JSONB NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "CatalogStatus" NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sub_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_categories" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" JSONB NOT NULL,
    "icon" TEXT NOT NULL,
    "min_amount_paise" BIGINT NOT NULL,
    "max_amount_paise" BIGINT NOT NULL,
    "step_paise" BIGINT NOT NULL,
    "default_amount_paise" BIGINT NOT NULL,
    "tenure_options_months" INTEGER[],
    "illustrative_rate_bps" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "CatalogStatus" NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "loan_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_segments" (
    "category_id" UUID NOT NULL,
    "segment_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "category_segments_pkey" PRIMARY KEY ("category_id","segment_id")
);

-- CreateTable
CREATE TABLE "category_purposes" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" JSONB NOT NULL,
    "requires_note" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "CatalogStatus" NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "category_purposes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_states" (
    "id" UUID NOT NULL,
    "gst_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "GeoStateKind" NOT NULL,
    "status" "CatalogStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "geo_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_cities" (
    "id" UUID NOT NULL,
    "state_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "CatalogStatus" NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "geo_cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geo_pincodes" (
    "pincode" TEXT NOT NULL,
    "state_id" UUID NOT NULL,
    "city_id" UUID,
    "district" TEXT,
    "status" "CatalogStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "geo_pincodes_pkey" PRIMARY KEY ("pincode")
);

-- CreateTable
CREATE TABLE "lookup_aliases" (
    "id" UUID NOT NULL,
    "kind" "AliasKind" NOT NULL,
    "alias" TEXT NOT NULL,
    "target_id" UUID NOT NULL,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lookup_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "segments_key_key" ON "segments"("key");

-- CreateIndex
CREATE UNIQUE INDEX "sub_segments_key_key" ON "sub_segments"("key");

-- CreateIndex
CREATE INDEX "sub_segments_segment_id_idx" ON "sub_segments"("segment_id");

-- CreateIndex
CREATE UNIQUE INDEX "loan_categories_key_key" ON "loan_categories"("key");

-- CreateIndex
CREATE INDEX "category_segments_segment_id_sort_order_idx" ON "category_segments"("segment_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "category_purposes_category_id_key_key" ON "category_purposes"("category_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "geo_states_gst_code_key" ON "geo_states"("gst_code");

-- CreateIndex
CREATE UNIQUE INDEX "geo_states_name_key" ON "geo_states"("name");

-- CreateIndex
CREATE INDEX "geo_cities_name_idx" ON "geo_cities"("name");

-- CreateIndex
CREATE UNIQUE INDEX "geo_cities_state_id_name_key" ON "geo_cities"("state_id", "name");

-- CreateIndex
CREATE INDEX "geo_pincodes_city_id_idx" ON "geo_pincodes"("city_id");

-- CreateIndex
CREATE INDEX "geo_pincodes_state_id_idx" ON "geo_pincodes"("state_id");

-- CreateIndex
CREATE INDEX "lookup_aliases_target_id_idx" ON "lookup_aliases"("target_id");

-- CreateIndex
CREATE UNIQUE INDEX "lookup_aliases_kind_alias_key" ON "lookup_aliases"("kind", "alias");

-- AddForeignKey
ALTER TABLE "sub_segments" ADD CONSTRAINT "sub_segments_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "segments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_segments" ADD CONSTRAINT "category_segments_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "loan_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_segments" ADD CONSTRAINT "category_segments_segment_id_fkey" FOREIGN KEY ("segment_id") REFERENCES "segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_purposes" ADD CONSTRAINT "category_purposes_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "loan_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_cities" ADD CONSTRAINT "geo_cities_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "geo_states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_pincodes" ADD CONSTRAINT "geo_pincodes_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "geo_states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "geo_pincodes" ADD CONSTRAINT "geo_pincodes_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "geo_cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;
