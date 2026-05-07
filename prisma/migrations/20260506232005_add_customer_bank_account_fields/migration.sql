-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "account_holder" VARCHAR(100),
ADD COLUMN     "account_number" VARCHAR(20),
ADD COLUMN     "account_type" VARCHAR(10),
ADD COLUMN     "bank_name" VARCHAR(50),
ADD COLUMN     "branch_name" VARCHAR(50);
