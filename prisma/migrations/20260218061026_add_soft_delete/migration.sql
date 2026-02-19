/*
  Warnings:

  - You are about to alter the column `account_number` on the `billing_infos` table. The data in that column could be lost. The data in that column will be cast from `VarChar(50)` to `VarChar(20)`.
  - You are about to drop the column `memo` on the `buried_persons` table. All the data in the column will be lost.
  - You are about to drop the column `physical_plot_id` on the `buried_persons` table. All the data in the column will be lost.
  - The `gender` column on the `buried_persons` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `physical_plot_id` on the `collective_burials` table. All the data in the column will be lost.
  - The `billing_status` column on the `collective_burials` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `billing_amount` on the `collective_burials` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `Integer`.
  - You are about to drop the column `construction_notes` on the `construction_infos` table. All the data in the column will be lost.
  - You are about to drop the column `payment_scheduled_date_2` on the `construction_infos` table. All the data in the column will be lost.
  - You are about to drop the column `physical_plot_id` on the `construction_infos` table. All the data in the column will be lost.
  - You are about to alter the column `work_amount_1` on the `construction_infos` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `Integer`.
  - You are about to alter the column `work_amount_2` on the `construction_infos` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `Integer`.
  - You are about to alter the column `payment_amount_1` on the `construction_infos` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `Integer`.
  - You are about to alter the column `payment_amount_2` on the `construction_infos` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `Integer`.
  - You are about to drop the column `sale_status` on the `contract_plots` table. All the data in the column will be lost.
  - The `gender` column on the `customers` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `postal_code` on the `customers` table. The data in that column could be lost. The data in that column will be cast from `VarChar(8)` to `VarChar(7)`.
  - You are about to alter the column `phone_number` on the `customers` table. The data in that column could be lost. The data in that column will be cast from `VarChar(15)` to `VarChar(11)`.
  - You are about to alter the column `fax_number` on the `customers` table. The data in that column could be lost. The data in that column will be cast from `VarChar(15)` to `VarChar(11)`.
  - You are about to drop the column `company_address` on the `family_contacts` table. All the data in the column will be lost.
  - You are about to drop the column `company_name` on the `family_contacts` table. All the data in the column will be lost.
  - You are about to drop the column `company_name_kana` on the `family_contacts` table. All the data in the column will be lost.
  - You are about to drop the column `company_phone` on the `family_contacts` table. All the data in the column will be lost.
  - You are about to drop the column `physical_plot_id` on the `family_contacts` table. All the data in the column will be lost.
  - You are about to alter the column `phone_number` on the `family_contacts` table. The data in that column could be lost. The data in that column will be cast from `VarChar(15)` to `VarChar(11)`.
  - You are about to alter the column `fax_number` on the `family_contacts` table. The data in that column could be lost. The data in that column will be cast from `VarChar(15)` to `VarChar(11)`.
  - The `mailing_type` column on the `family_contacts` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `physical_plot_id` on the `gravestone_infos` table. All the data in the column will be lost.
  - You are about to drop the column `plot_id` on the `histories` table. All the data in the column will be lost.
  - You are about to alter the column `entity_id` on the `histories` table. The data in that column could be lost. The data in that column will be cast from `VarChar(255)` to `VarChar(36)`.
  - The `status` column on the `physical_plots` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `role` column on the `staff` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `work_postal_code` on the `work_infos` table. The data in that column could be lost. The data in that column will be cast from `VarChar(8)` to `VarChar(7)`.
  - You are about to alter the column `work_phone_number` on the `work_infos` table. The data in that column could be lost. The data in that column will be cast from `VarChar(15)` to `VarChar(11)`.
  - You are about to drop the `denomination_master` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `emergency_contacts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `gender_master` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `prefecture_master` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `relation_master` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `sale_contracts` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `update_type_master` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `usage_status_master` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[contract_plot_id]` on the table `collective_burials` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[contract_plot_id]` on the table `gravestone_infos` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `billing_type` on the `billing_infos` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `account_type` on the `billing_infos` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `contract_plot_id` to the `buried_persons` table without a default value. This is not possible if the table is not empty.
  - Added the required column `contract_plot_id` to the `collective_burials` table without a default value. This is not possible if the table is not empty.
  - Added the required column `contract_plot_id` to the `construction_infos` table without a default value. This is not possible if the table is not empty.
  - Added the required column `contract_date` to the `contract_plots` table without a default value. This is not possible if the table is not empty.
  - Added the required column `price` to the `contract_plots` table without a default value. This is not possible if the table is not empty.
  - Added the required column `contract_plot_id` to the `family_contacts` table without a default value. This is not possible if the table is not empty.
  - Added the required column `contract_plot_id` to the `gravestone_infos` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `action_type` on the `histories` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `supabase_uid` on table `staff` required. This step will fail if there are existing NULL values in that column.
  - Changed the type of `dm_setting` on the `work_infos` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `address_type` on the `work_infos` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "PhysicalPlotStatus" AS ENUM ('available', 'partially_sold', 'sold_out');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('unpaid', 'partial_paid', 'paid', 'overdue', 'refunded', 'cancelled');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'not_answered');

-- CreateEnum
CREATE TYPE "ContractRole" AS ENUM ('applicant', 'contractor');

-- CreateEnum
CREATE TYPE "AddressType" AS ENUM ('home', 'work', 'other');

-- CreateEnum
CREATE TYPE "DmSetting" AS ENUM ('allow', 'deny', 'limited');

-- CreateEnum
CREATE TYPE "BillingType" AS ENUM ('individual', 'corporate', 'bank_transfer');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ordinary', 'current', 'savings');

-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('pending', 'billed', 'paid');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('CREATE', 'UPDATE', 'DELETE');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('invoice', 'postcard', 'contract', 'permit', 'other');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('draft', 'generated', 'sent', 'archived');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('viewer', 'operator', 'manager', 'admin');

-- DropForeignKey
ALTER TABLE "buried_persons" DROP CONSTRAINT "buried_persons_physical_plot_id_fkey";

-- DropForeignKey
ALTER TABLE "collective_burials" DROP CONSTRAINT "collective_burials_physical_plot_id_fkey";

-- DropForeignKey
ALTER TABLE "construction_infos" DROP CONSTRAINT "construction_infos_physical_plot_id_fkey";

-- DropForeignKey
ALTER TABLE "emergency_contacts" DROP CONSTRAINT "emergency_contacts_physical_plot_id_fkey";

-- DropForeignKey
ALTER TABLE "family_contacts" DROP CONSTRAINT "family_contacts_physical_plot_id_fkey";

-- DropForeignKey
ALTER TABLE "gravestone_infos" DROP CONSTRAINT "gravestone_infos_physical_plot_id_fkey";

-- DropForeignKey
ALTER TABLE "sale_contracts" DROP CONSTRAINT "sale_contracts_contract_plot_id_fkey";

-- DropForeignKey
ALTER TABLE "sale_contracts" DROP CONSTRAINT "sale_contracts_customer_id_fkey";

-- DropIndex
DROP INDEX "buried_persons_physical_plot_id_idx";

-- DropIndex
DROP INDEX "collective_burials_physical_plot_id_idx";

-- DropIndex
DROP INDEX "collective_burials_physical_plot_id_key";

-- DropIndex
DROP INDEX "construction_infos_physical_plot_id_idx";

-- DropIndex
DROP INDEX "construction_infos_physical_plot_id_key";

-- DropIndex
DROP INDEX "contract_plots_sale_status_idx";

-- DropIndex
DROP INDEX "family_contacts_physical_plot_id_idx";

-- DropIndex
DROP INDEX "gravestone_infos_physical_plot_id_idx";

-- DropIndex
DROP INDEX "gravestone_infos_physical_plot_id_key";

-- DropIndex
DROP INDEX "histories_plot_id_idx";

-- AlterTable
ALTER TABLE "billing_infos" DROP COLUMN "billing_type",
ADD COLUMN     "billing_type" "BillingType" NOT NULL,
DROP COLUMN "account_type",
ADD COLUMN     "account_type" "AccountType" NOT NULL,
ALTER COLUMN "account_number" SET DATA TYPE VARCHAR(20);

-- AlterTable
ALTER TABLE "buried_persons" DROP COLUMN "memo",
DROP COLUMN "physical_plot_id",
ADD COLUMN     "contract_plot_id" TEXT NOT NULL,
ADD COLUMN     "notes" TEXT,
DROP COLUMN "gender",
ADD COLUMN     "gender" "Gender";

-- AlterTable
ALTER TABLE "collective_burials" DROP COLUMN "physical_plot_id",
ADD COLUMN     "contract_plot_id" TEXT NOT NULL,
DROP COLUMN "billing_status",
ADD COLUMN     "billing_status" "BillingStatus" NOT NULL DEFAULT 'pending',
ALTER COLUMN "billing_amount" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "construction_infos" DROP COLUMN "construction_notes",
DROP COLUMN "payment_scheduled_date_2",
DROP COLUMN "physical_plot_id",
ADD COLUMN     "contract_plot_id" TEXT NOT NULL,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "payment_date_2" DATE,
ALTER COLUMN "work_amount_1" SET DATA TYPE INTEGER,
ALTER COLUMN "work_amount_2" SET DATA TYPE INTEGER,
ALTER COLUMN "payment_amount_1" SET DATA TYPE INTEGER,
ALTER COLUMN "payment_amount_2" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "contract_plots" DROP COLUMN "sale_status",
ADD COLUMN     "acceptance_number" VARCHAR(50),
ADD COLUMN     "contract_date" DATE NOT NULL,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "payment_status" "PaymentStatus" NOT NULL DEFAULT 'unpaid',
ADD COLUMN     "permit_date" DATE,
ADD COLUMN     "permit_number" VARCHAR(50),
ADD COLUMN     "price" INTEGER NOT NULL,
ADD COLUMN     "reservation_date" DATE,
ADD COLUMN     "start_date" DATE,
ALTER COLUMN "contract_status" SET DEFAULT 'draft';

-- AlterTable
ALTER TABLE "customers" DROP COLUMN "gender",
ADD COLUMN     "gender" "Gender",
ALTER COLUMN "postal_code" SET DATA TYPE VARCHAR(7),
ALTER COLUMN "phone_number" SET DATA TYPE VARCHAR(11),
ALTER COLUMN "fax_number" SET DATA TYPE VARCHAR(11),
ALTER COLUMN "email" SET DATA TYPE VARCHAR(254);

-- AlterTable
ALTER TABLE "family_contacts" DROP COLUMN "company_address",
DROP COLUMN "company_name",
DROP COLUMN "company_name_kana",
DROP COLUMN "company_phone",
DROP COLUMN "physical_plot_id",
ADD COLUMN     "contract_plot_id" TEXT NOT NULL,
ADD COLUMN     "customer_id" TEXT,
ADD COLUMN     "emergency_contact_flag" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "postal_code" VARCHAR(7),
ALTER COLUMN "phone_number" SET DATA TYPE VARCHAR(11),
ALTER COLUMN "fax_number" SET DATA TYPE VARCHAR(11),
ALTER COLUMN "email" SET DATA TYPE VARCHAR(254),
DROP COLUMN "mailing_type",
ADD COLUMN     "mailing_type" "AddressType";

-- AlterTable
ALTER TABLE "gravestone_infos" DROP COLUMN "physical_plot_id",
ADD COLUMN     "contract_plot_id" TEXT NOT NULL,
ALTER COLUMN "gravestone_base" DROP NOT NULL,
ALTER COLUMN "enclosure_position" DROP NOT NULL,
ALTER COLUMN "gravestone_dealer" DROP NOT NULL,
ALTER COLUMN "gravestone_type" DROP NOT NULL,
ALTER COLUMN "surrounding_area" DROP NOT NULL;

-- AlterTable
ALTER TABLE "histories" DROP COLUMN "plot_id",
ADD COLUMN     "after_record" JSONB,
ADD COLUMN     "before_record" JSONB,
ADD COLUMN     "contract_plot_id" TEXT,
ADD COLUMN     "physical_plot_id" TEXT,
ALTER COLUMN "entity_id" SET DATA TYPE VARCHAR(36),
DROP COLUMN "action_type",
ADD COLUMN     "action_type" "ActionType" NOT NULL;

-- AlterTable
ALTER TABLE "management_fees" ALTER COLUMN "calculation_type" DROP NOT NULL,
ALTER COLUMN "tax_type" DROP NOT NULL,
ALTER COLUMN "billing_type" DROP NOT NULL,
ALTER COLUMN "billing_years" DROP NOT NULL,
ALTER COLUMN "area" DROP NOT NULL,
ALTER COLUMN "billing_month" DROP NOT NULL,
ALTER COLUMN "management_fee" DROP NOT NULL,
ALTER COLUMN "unit_price" DROP NOT NULL,
ALTER COLUMN "last_billing_month" DROP NOT NULL,
ALTER COLUMN "payment_method" DROP NOT NULL;

-- AlterTable
ALTER TABLE "physical_plots" ALTER COLUMN "plot_number" SET DATA TYPE VARCHAR(50),
DROP COLUMN "status",
ADD COLUMN     "status" "PhysicalPlotStatus" NOT NULL DEFAULT 'available';

-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ALTER COLUMN "supabase_uid" SET NOT NULL,
ALTER COLUMN "email" SET DATA TYPE VARCHAR(254),
DROP COLUMN "role",
ADD COLUMN     "role" "StaffRole" NOT NULL DEFAULT 'viewer';

-- AlterTable
ALTER TABLE "usage_fees" ALTER COLUMN "calculation_type" DROP NOT NULL,
ALTER COLUMN "tax_type" DROP NOT NULL,
ALTER COLUMN "billing_type" DROP NOT NULL,
ALTER COLUMN "billing_years" DROP NOT NULL,
ALTER COLUMN "area" DROP NOT NULL,
ALTER COLUMN "unit_price" DROP NOT NULL,
ALTER COLUMN "usage_fee" DROP NOT NULL,
ALTER COLUMN "payment_method" DROP NOT NULL;

-- AlterTable
ALTER TABLE "work_infos" ALTER COLUMN "work_postal_code" SET DATA TYPE VARCHAR(7),
ALTER COLUMN "work_phone_number" SET DATA TYPE VARCHAR(11),
DROP COLUMN "dm_setting",
ADD COLUMN     "dm_setting" "DmSetting" NOT NULL,
DROP COLUMN "address_type",
ADD COLUMN     "address_type" "AddressType" NOT NULL;

-- DropTable
DROP TABLE "denomination_master";

-- DropTable
DROP TABLE "emergency_contacts";

-- DropTable
DROP TABLE "gender_master";

-- DropTable
DROP TABLE "prefecture_master";

-- DropTable
DROP TABLE "relation_master";

-- DropTable
DROP TABLE "sale_contracts";

-- DropTable
DROP TABLE "update_type_master";

-- DropTable
DROP TABLE "usage_status_master";

-- CreateTable
CREATE TABLE "sale_contract_roles" (
    "sale_contract_role_id" TEXT NOT NULL,
    "contract_plot_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "role" "ContractRole" NOT NULL,
    "role_start_date" DATE,
    "role_end_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sale_contract_roles_pkey" PRIMARY KEY ("sale_contract_role_id")
);

-- CreateTable
CREATE TABLE "documents" (
    "document_id" TEXT NOT NULL,
    "contract_plot_id" TEXT,
    "customer_id" TEXT,
    "type" "DocumentType" NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'draft',
    "file_key" VARCHAR(500),
    "file_name" VARCHAR(200),
    "file_size" INTEGER,
    "mime_type" VARCHAR(100),
    "template_type" VARCHAR(50),
    "template_data" JSONB,
    "generated_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_by" VARCHAR(100),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("document_id")
);

-- CreateIndex
CREATE INDEX "sale_contract_roles_contract_plot_id_idx" ON "sale_contract_roles"("contract_plot_id");

-- CreateIndex
CREATE INDEX "sale_contract_roles_customer_id_idx" ON "sale_contract_roles"("customer_id");

-- CreateIndex
CREATE INDEX "sale_contract_roles_role_idx" ON "sale_contract_roles"("role");

-- CreateIndex
CREATE INDEX "sale_contract_roles_deleted_at_idx" ON "sale_contract_roles"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "sale_contract_roles_contract_plot_id_customer_id_role_delet_key" ON "sale_contract_roles"("contract_plot_id", "customer_id", "role", "deleted_at");

-- CreateIndex
CREATE INDEX "documents_contract_plot_id_idx" ON "documents"("contract_plot_id");

-- CreateIndex
CREATE INDEX "documents_customer_id_idx" ON "documents"("customer_id");

-- CreateIndex
CREATE INDEX "documents_type_idx" ON "documents"("type");

-- CreateIndex
CREATE INDEX "documents_status_idx" ON "documents"("status");

-- CreateIndex
CREATE INDEX "documents_deleted_at_idx" ON "documents"("deleted_at");

-- CreateIndex
CREATE INDEX "buried_persons_contract_plot_id_idx" ON "buried_persons"("contract_plot_id");

-- CreateIndex
CREATE UNIQUE INDEX "collective_burials_contract_plot_id_key" ON "collective_burials"("contract_plot_id");

-- CreateIndex
CREATE INDEX "collective_burials_contract_plot_id_idx" ON "collective_burials"("contract_plot_id");

-- CreateIndex
CREATE INDEX "collective_burials_billing_status_idx" ON "collective_burials"("billing_status");

-- CreateIndex
CREATE INDEX "construction_infos_contract_plot_id_idx" ON "construction_infos"("contract_plot_id");

-- CreateIndex
CREATE INDEX "contract_plots_contract_date_idx" ON "contract_plots"("contract_date");

-- CreateIndex
CREATE INDEX "contract_plots_payment_status_idx" ON "contract_plots"("payment_status");

-- CreateIndex
CREATE INDEX "family_contacts_contract_plot_id_idx" ON "family_contacts"("contract_plot_id");

-- CreateIndex
CREATE INDEX "family_contacts_customer_id_idx" ON "family_contacts"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "gravestone_infos_contract_plot_id_key" ON "gravestone_infos"("contract_plot_id");

-- CreateIndex
CREATE INDEX "gravestone_infos_contract_plot_id_idx" ON "gravestone_infos"("contract_plot_id");

-- CreateIndex
CREATE INDEX "histories_physical_plot_id_idx" ON "histories"("physical_plot_id");

-- CreateIndex
CREATE INDEX "histories_contract_plot_id_idx" ON "histories"("contract_plot_id");

-- CreateIndex
CREATE INDEX "physical_plots_status_idx" ON "physical_plots"("status");

-- CreateIndex
CREATE INDEX "staff_role_is_active_idx" ON "staff"("role", "is_active");

-- CreateIndex
CREATE INDEX "staff_deleted_at_idx" ON "staff"("deleted_at");

-- AddForeignKey
ALTER TABLE "sale_contract_roles" ADD CONSTRAINT "sale_contract_roles_contract_plot_id_fkey" FOREIGN KEY ("contract_plot_id") REFERENCES "contract_plots"("contract_plot_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_contract_roles" ADD CONSTRAINT "sale_contract_roles_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gravestone_infos" ADD CONSTRAINT "gravestone_infos_contract_plot_id_fkey" FOREIGN KEY ("contract_plot_id") REFERENCES "contract_plots"("contract_plot_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "construction_infos" ADD CONSTRAINT "construction_infos_contract_plot_id_fkey" FOREIGN KEY ("contract_plot_id") REFERENCES "contract_plots"("contract_plot_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_contacts" ADD CONSTRAINT "family_contacts_contract_plot_id_fkey" FOREIGN KEY ("contract_plot_id") REFERENCES "contract_plots"("contract_plot_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_contacts" ADD CONSTRAINT "family_contacts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buried_persons" ADD CONSTRAINT "buried_persons_contract_plot_id_fkey" FOREIGN KEY ("contract_plot_id") REFERENCES "contract_plots"("contract_plot_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collective_burials" ADD CONSTRAINT "collective_burials_contract_plot_id_fkey" FOREIGN KEY ("contract_plot_id") REFERENCES "contract_plots"("contract_plot_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "histories" ADD CONSTRAINT "histories_physical_plot_id_fkey" FOREIGN KEY ("physical_plot_id") REFERENCES "physical_plots"("physical_plot_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "histories" ADD CONSTRAINT "histories_contract_plot_id_fkey" FOREIGN KEY ("contract_plot_id") REFERENCES "contract_plots"("contract_plot_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_contract_plot_id_fkey" FOREIGN KEY ("contract_plot_id") REFERENCES "contract_plots"("contract_plot_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id") ON DELETE SET NULL ON UPDATE CASCADE;
