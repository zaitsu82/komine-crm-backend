/*
  Warnings:

  - Added the required column `customer_role` to the `sale_contracts` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "sale_contracts" ADD COLUMN     "customer_role" VARCHAR(20) NOT NULL;

-- CreateIndex
CREATE INDEX "sale_contracts_customer_role_idx" ON "sale_contracts"("customer_role");
