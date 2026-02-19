-- Add ContractStatus enum
CREATE TYPE "ContractStatus" AS ENUM ('draft', 'reserved', 'active', 'suspended', 'terminated', 'cancelled', 'transferred');

-- Add contract_status column to contract_plots
ALTER TABLE "contract_plots" ADD COLUMN "contract_status" "ContractStatus" NOT NULL DEFAULT 'active';

-- Create index for contract_status
CREATE INDEX "contract_plots_contract_status_idx" ON "contract_plots"("contract_status");

-- Migrate existing data: map payment_status to contract_status (only if column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contract_plots' AND column_name = 'payment_status'
  ) THEN
    UPDATE "contract_plots"
    SET "contract_status" = CASE
      WHEN "payment_status" = 'cancelled' THEN 'cancelled'::"ContractStatus"
      WHEN "payment_status" = 'refunded' THEN 'cancelled'::"ContractStatus"
      WHEN "payment_status" = 'overdue' THEN 'suspended'::"ContractStatus"
      ELSE 'active'::"ContractStatus"
    END;
  END IF;
END $$;
