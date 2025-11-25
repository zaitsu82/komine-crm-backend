-- CreateTable
CREATE TABLE "gravestone_infos" (
    "gravestone_info_id" TEXT NOT NULL,
    "physical_plot_id" TEXT NOT NULL,
    "gravestone_base" VARCHAR(100) NOT NULL,
    "enclosure_position" VARCHAR(100) NOT NULL,
    "gravestone_dealer" VARCHAR(100) NOT NULL,
    "gravestone_type" VARCHAR(50) NOT NULL,
    "surrounding_area" VARCHAR(100) NOT NULL,
    "establishment_deadline" DATE,
    "establishment_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "gravestone_infos_pkey" PRIMARY KEY ("gravestone_info_id")
);

-- CreateTable
CREATE TABLE "construction_infos" (
    "construction_info_id" TEXT NOT NULL,
    "physical_plot_id" TEXT NOT NULL,
    "construction_type" VARCHAR(50),
    "start_date" DATE,
    "completion_date" DATE,
    "contractor" VARCHAR(100),
    "supervisor" VARCHAR(100),
    "progress" VARCHAR(100),
    "work_item_1" VARCHAR(100),
    "work_date_1" DATE,
    "work_amount_1" DECIMAL(15,2),
    "work_status_1" VARCHAR(50),
    "work_item_2" VARCHAR(100),
    "work_date_2" DATE,
    "work_amount_2" DECIMAL(15,2),
    "work_status_2" VARCHAR(50),
    "permit_number" VARCHAR(50),
    "application_date" DATE,
    "permit_date" DATE,
    "permit_status" VARCHAR(50),
    "payment_type_1" VARCHAR(50),
    "payment_amount_1" DECIMAL(15,2),
    "payment_date_1" DATE,
    "payment_status_1" VARCHAR(50),
    "payment_type_2" VARCHAR(50),
    "payment_amount_2" DECIMAL(15,2),
    "payment_scheduled_date_2" DATE,
    "payment_status_2" VARCHAR(50),
    "construction_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "construction_infos_pkey" PRIMARY KEY ("construction_info_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gravestone_infos_physical_plot_id_key" ON "gravestone_infos"("physical_plot_id");

-- CreateIndex
CREATE INDEX "gravestone_infos_physical_plot_id_idx" ON "gravestone_infos"("physical_plot_id");

-- CreateIndex
CREATE UNIQUE INDEX "construction_infos_physical_plot_id_key" ON "construction_infos"("physical_plot_id");

-- CreateIndex
CREATE INDEX "construction_infos_physical_plot_id_idx" ON "construction_infos"("physical_plot_id");

-- AddForeignKey
ALTER TABLE "gravestone_infos" ADD CONSTRAINT "gravestone_infos_physical_plot_id_fkey" FOREIGN KEY ("physical_plot_id") REFERENCES "physical_plots"("physical_plot_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "construction_infos" ADD CONSTRAINT "construction_infos_physical_plot_id_fkey" FOREIGN KEY ("physical_plot_id") REFERENCES "physical_plots"("physical_plot_id") ON DELETE CASCADE ON UPDATE CASCADE;
