-- CreateTable
CREATE TABLE "usage_fees" (
    "usage_fee_id" TEXT NOT NULL,
    "contract_plot_id" TEXT NOT NULL,
    "calculation_type" VARCHAR(20) NOT NULL,
    "tax_type" VARCHAR(20) NOT NULL,
    "billing_type" VARCHAR(20) NOT NULL,
    "billing_years" VARCHAR(20) NOT NULL,
    "area" VARCHAR(50) NOT NULL,
    "unit_price" VARCHAR(50) NOT NULL,
    "usage_fee" VARCHAR(50) NOT NULL,
    "payment_method" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "usage_fees_pkey" PRIMARY KEY ("usage_fee_id")
);

-- CreateTable
CREATE TABLE "management_fees" (
    "management_fee_id" TEXT NOT NULL,
    "contract_plot_id" TEXT NOT NULL,
    "calculation_type" VARCHAR(20) NOT NULL,
    "tax_type" VARCHAR(20) NOT NULL,
    "billing_type" VARCHAR(20) NOT NULL,
    "billing_years" VARCHAR(20) NOT NULL,
    "area" VARCHAR(50) NOT NULL,
    "billing_month" VARCHAR(20) NOT NULL,
    "management_fee" VARCHAR(50) NOT NULL,
    "unit_price" VARCHAR(50) NOT NULL,
    "last_billing_month" VARCHAR(20) NOT NULL,
    "payment_method" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "management_fees_pkey" PRIMARY KEY ("management_fee_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usage_fees_contract_plot_id_key" ON "usage_fees"("contract_plot_id");

-- CreateIndex
CREATE INDEX "usage_fees_contract_plot_id_idx" ON "usage_fees"("contract_plot_id");

-- CreateIndex
CREATE UNIQUE INDEX "management_fees_contract_plot_id_key" ON "management_fees"("contract_plot_id");

-- CreateIndex
CREATE INDEX "management_fees_contract_plot_id_idx" ON "management_fees"("contract_plot_id");

-- AddForeignKey
ALTER TABLE "usage_fees" ADD CONSTRAINT "usage_fees_contract_plot_id_fkey" FOREIGN KEY ("contract_plot_id") REFERENCES "contract_plots"("contract_plot_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "management_fees" ADD CONSTRAINT "management_fees_contract_plot_id_fkey" FOREIGN KEY ("contract_plot_id") REFERENCES "contract_plots"("contract_plot_id") ON DELETE CASCADE ON UPDATE CASCADE;
