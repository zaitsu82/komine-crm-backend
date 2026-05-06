-- =====================================================================
-- Phase 2 Legacy DB Migration
-- =====================================================================
-- レガシーDB(reien.*)実データ取り込みに向けたスキーマ移行。
--
-- 主な変更:
-- - ContractStatus: 7→3ステート(vacant/active/terminated)に簡略化
--   - draft/reserved → active に統合
--   - suspended/cancelled/transferred → terminated に統合
-- - PaymentStatus.cancelled 削除 → refunded に変換
-- - BillingType / AccountType enum 削除
-- - billing_infos / account_type_master テーブル削除
-- - 新規テーブル: relationship_master, billings, payments
-- - 既存テーブルへの新フィールド追加（map_id, staff_id, request_date など）
-- =====================================================================

-- ---------------------------------------------------------------------
-- Step 1: 旧 ContractStatus 値を新 enum 値に揃える（ALTER TYPE 前に必要）
-- ---------------------------------------------------------------------
UPDATE "contract_plots" SET "contract_status" = 'active' WHERE "contract_status"::text IN ('draft', 'reserved');
UPDATE "contract_plots" SET "contract_status" = 'terminated' WHERE "contract_status"::text IN ('suspended', 'cancelled', 'transferred');

-- ---------------------------------------------------------------------
-- Step 2: 旧 PaymentStatus.cancelled を refunded に変換
-- ---------------------------------------------------------------------
UPDATE "contract_plots" SET "payment_status" = 'refunded' WHERE "payment_status"::text = 'cancelled';

-- ---------------------------------------------------------------------
-- Step 3: 新 enum 追加
-- ---------------------------------------------------------------------
-- CreateEnum
CREATE TYPE "BillingCategory" AS ENUM ('usage_fee', 'management_fee', 'collective_fee', 'construction_fee', 'gravestone_fee', 'other');

-- CreateEnum
CREATE TYPE "BillingRecordStatus" AS ENUM ('pending', 'billed', 'partial_paid', 'paid', 'overdue', 'terminated', 'written_off');

-- ---------------------------------------------------------------------
-- Step 4: ContractStatus enum 値を 3 ステート化
-- ---------------------------------------------------------------------
-- AlterEnum
BEGIN;
CREATE TYPE "ContractStatus_new" AS ENUM ('vacant', 'active', 'terminated');
ALTER TABLE "public"."contract_plots" ALTER COLUMN "contract_status" DROP DEFAULT;
ALTER TABLE "contract_plots" ALTER COLUMN "contract_status" TYPE "ContractStatus_new" USING ("contract_status"::text::"ContractStatus_new");
ALTER TYPE "ContractStatus" RENAME TO "ContractStatus_old";
ALTER TYPE "ContractStatus_new" RENAME TO "ContractStatus";
DROP TYPE "public"."ContractStatus_old";
ALTER TABLE "contract_plots" ALTER COLUMN "contract_status" SET DEFAULT 'vacant';
COMMIT;

-- ---------------------------------------------------------------------
-- Step 5: PaymentStatus enum 値から cancelled を削除
-- ---------------------------------------------------------------------
-- AlterEnum
BEGIN;
CREATE TYPE "PaymentStatus_new" AS ENUM ('unpaid', 'partial_paid', 'paid', 'overdue', 'refunded');
ALTER TABLE "public"."contract_plots" ALTER COLUMN "payment_status" DROP DEFAULT;
ALTER TABLE "contract_plots" ALTER COLUMN "payment_status" TYPE "PaymentStatus_new" USING ("payment_status"::text::"PaymentStatus_new");
ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
DROP TYPE "public"."PaymentStatus_old";
ALTER TABLE "contract_plots" ALTER COLUMN "payment_status" SET DEFAULT 'unpaid';
COMMIT;

-- ---------------------------------------------------------------------
-- Step 6: テーブル変更（フィールド追加・nullable化）
-- ---------------------------------------------------------------------
-- DropForeignKey
ALTER TABLE "billing_infos" DROP CONSTRAINT "billing_infos_customer_id_fkey";

-- AlterTable
ALTER TABLE "buried_persons" ADD COLUMN     "cause_of_death" VARCHAR(200),
ADD COLUMN     "chief_mourner_name" VARCHAR(100),
ADD COLUMN     "chief_mourner_relationship" VARCHAR(50),
ADD COLUMN     "death_place" VARCHAR(200);

-- AlterTable
ALTER TABLE "contract_plots" ADD COLUMN     "grave_kind" INTEGER,
ADD COLUMN     "grave_kubun" INTEGER,
ADD COLUMN     "grave_type" INTEGER,
ADD COLUMN     "legacy_grave_cd" INTEGER,
ADD COLUMN     "request_date" DATE,
ALTER COLUMN "contract_status" SET DEFAULT 'vacant',
ALTER COLUMN "contract_date" DROP NOT NULL,
ALTER COLUMN "price" DROP NOT NULL;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "legacy_danka_cd" INTEGER,
ADD COLUMN     "staff_id" INTEGER;

-- AlterTable
ALTER TABLE "gravestone_infos" ADD COLUMN     "direction_id" INTEGER,
ADD COLUMN     "gravestone_inscription" VARCHAR(200),
ADD COLUMN     "position_id" INTEGER;

-- AlterTable
ALTER TABLE "physical_plots" ADD COLUMN     "map_id" INTEGER;

-- ---------------------------------------------------------------------
-- Step 7: 廃止モデルの削除
-- ---------------------------------------------------------------------
-- DropTable
DROP TABLE "account_type_master";

-- DropTable
DROP TABLE "billing_infos";

-- DropEnum
DROP TYPE "AccountType";

-- DropEnum
DROP TYPE "BillingType";

-- ---------------------------------------------------------------------
-- Step 8: 新規テーブル
-- ---------------------------------------------------------------------
-- CreateTable
CREATE TABLE "relationship_master" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(200),
    "sort_order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relationship_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billings" (
    "billing_id" TEXT NOT NULL,
    "contract_plot_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "category" "BillingCategory" NOT NULL,
    "use_start_year" INTEGER,
    "use_end_year" INTEGER,
    "target_month" INTEGER,
    "billing_years" INTEGER,
    "amount" INTEGER NOT NULL,
    "contract_date" DATE,
    "billing_date" DATE,
    "paid_amount" INTEGER NOT NULL DEFAULT 0,
    "last_payment_date" DATE,
    "terminated" BOOLEAN NOT NULL DEFAULT false,
    "terminated_date" DATE,
    "status" "BillingRecordStatus" NOT NULL DEFAULT 'pending',
    "application_type" INTEGER,
    "billing_type" INTEGER,
    "notes" TEXT,
    "legacy_seikyu_cd" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "billings_pkey" PRIMARY KEY ("billing_id")
);

-- CreateTable
CREATE TABLE "payments" (
    "payment_id" TEXT NOT NULL,
    "billing_id" TEXT,
    "customer_id" TEXT,
    "contract_plot_id" TEXT,
    "scheduled_date" DATE,
    "scheduled_amount" INTEGER,
    "payment_date" DATE,
    "payment_amount" INTEGER NOT NULL,
    "fee_type" VARCHAR(50),
    "application_type" INTEGER,
    "billing_type" INTEGER,
    "staff_in_charge" VARCHAR(100),
    "notes" TEXT,
    "legacy_nyukin_cd" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("payment_id")
);

-- ---------------------------------------------------------------------
-- Step 9: インデックス
-- ---------------------------------------------------------------------
-- CreateIndex
CREATE UNIQUE INDEX "relationship_master_code_key" ON "relationship_master"("code");

-- CreateIndex
CREATE UNIQUE INDEX "billings_legacy_seikyu_cd_key" ON "billings"("legacy_seikyu_cd");

-- CreateIndex
CREATE INDEX "billings_contract_plot_id_idx" ON "billings"("contract_plot_id");

-- CreateIndex
CREATE INDEX "billings_customer_id_idx" ON "billings"("customer_id");

-- CreateIndex
CREATE INDEX "billings_category_idx" ON "billings"("category");

-- CreateIndex
CREATE INDEX "billings_status_idx" ON "billings"("status");

-- CreateIndex
CREATE INDEX "billings_billing_date_idx" ON "billings"("billing_date");

-- CreateIndex
CREATE INDEX "billings_deleted_at_idx" ON "billings"("deleted_at");

-- CreateIndex
CREATE INDEX "billings_legacy_seikyu_cd_idx" ON "billings"("legacy_seikyu_cd");

-- CreateIndex
CREATE UNIQUE INDEX "payments_legacy_nyukin_cd_key" ON "payments"("legacy_nyukin_cd");

-- CreateIndex
CREATE INDEX "payments_billing_id_idx" ON "payments"("billing_id");

-- CreateIndex
CREATE INDEX "payments_customer_id_idx" ON "payments"("customer_id");

-- CreateIndex
CREATE INDEX "payments_contract_plot_id_idx" ON "payments"("contract_plot_id");

-- CreateIndex
CREATE INDEX "payments_payment_date_idx" ON "payments"("payment_date");

-- CreateIndex
CREATE INDEX "payments_deleted_at_idx" ON "payments"("deleted_at");

-- CreateIndex
CREATE INDEX "payments_legacy_nyukin_cd_idx" ON "payments"("legacy_nyukin_cd");

-- CreateIndex
CREATE INDEX "contract_plots_legacy_grave_cd_idx" ON "contract_plots"("legacy_grave_cd");

-- CreateIndex
CREATE INDEX "customers_staff_id_idx" ON "customers"("staff_id");

-- CreateIndex
CREATE INDEX "customers_legacy_danka_cd_idx" ON "customers"("legacy_danka_cd");

-- ---------------------------------------------------------------------
-- Step 10: 外部キー
-- ---------------------------------------------------------------------
-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("staff_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billings" ADD CONSTRAINT "billings_contract_plot_id_fkey" FOREIGN KEY ("contract_plot_id") REFERENCES "contract_plots"("contract_plot_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billings" ADD CONSTRAINT "billings_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_billing_id_fkey" FOREIGN KEY ("billing_id") REFERENCES "billings"("billing_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_contract_plot_id_fkey" FOREIGN KEY ("contract_plot_id") REFERENCES "contract_plots"("contract_plot_id") ON DELETE SET NULL ON UPDATE CASCADE;
