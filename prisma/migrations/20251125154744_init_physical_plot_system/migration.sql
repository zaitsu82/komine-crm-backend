-- CreateTable
CREATE TABLE "physical_plots" (
    "physical_plot_id" TEXT NOT NULL,
    "plot_number" VARCHAR(20) NOT NULL,
    "area_name" VARCHAR(100) NOT NULL,
    "area_sqm" DECIMAL(5,2) NOT NULL DEFAULT 3.6,
    "status" VARCHAR(20) NOT NULL DEFAULT 'available',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "physical_plots_pkey" PRIMARY KEY ("physical_plot_id")
);

-- CreateTable
CREATE TABLE "contract_plots" (
    "contract_plot_id" TEXT NOT NULL,
    "physical_plot_id" TEXT NOT NULL,
    "contract_area_sqm" DECIMAL(5,2) NOT NULL,
    "sale_status" VARCHAR(20) NOT NULL DEFAULT 'available',
    "location_description" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "contract_plots_pkey" PRIMARY KEY ("contract_plot_id")
);

-- CreateTable
CREATE TABLE "sale_contracts" (
    "sale_contract_id" TEXT NOT NULL,
    "contract_plot_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "contract_date" DATE NOT NULL,
    "price" DECIMAL(15,2) NOT NULL,
    "payment_status" VARCHAR(20) NOT NULL DEFAULT 'unpaid',
    "reservation_date" DATE,
    "acceptance_number" VARCHAR(50),
    "permit_date" DATE,
    "start_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "sale_contracts_pkey" PRIMARY KEY ("sale_contract_id")
);

-- CreateTable
CREATE TABLE "customers" (
    "customer_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "name_kana" VARCHAR(100) NOT NULL,
    "birth_date" DATE,
    "gender" VARCHAR(10),
    "postal_code" VARCHAR(8) NOT NULL,
    "address" VARCHAR(200) NOT NULL,
    "registered_address" VARCHAR(200),
    "phone_number" VARCHAR(15) NOT NULL,
    "fax_number" VARCHAR(15),
    "email" VARCHAR(100),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("customer_id")
);

-- CreateTable
CREATE TABLE "family_contacts" (
    "family_contact_id" TEXT NOT NULL,
    "physical_plot_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "birth_date" DATE,
    "relationship" VARCHAR(50) NOT NULL,
    "address" VARCHAR(200) NOT NULL,
    "phone_number" VARCHAR(15) NOT NULL,
    "fax_number" VARCHAR(15),
    "email" VARCHAR(100),
    "registered_address" VARCHAR(200),
    "mailing_type" VARCHAR(20),
    "company_name" VARCHAR(100),
    "company_name_kana" VARCHAR(100),
    "company_address" VARCHAR(200),
    "company_phone" VARCHAR(15),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "family_contacts_pkey" PRIMARY KEY ("family_contact_id")
);

-- CreateTable
CREATE TABLE "emergency_contacts" (
    "emergency_contact_id" TEXT NOT NULL,
    "physical_plot_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "relationship" VARCHAR(50) NOT NULL,
    "phone_number" VARCHAR(15) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "emergency_contacts_pkey" PRIMARY KEY ("emergency_contact_id")
);

-- CreateTable
CREATE TABLE "buried_persons" (
    "buried_person_id" TEXT NOT NULL,
    "physical_plot_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "name_kana" VARCHAR(100),
    "relationship" VARCHAR(50),
    "death_date" DATE,
    "age" INTEGER,
    "gender" VARCHAR(10),
    "burial_date" DATE,
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "buried_persons_pkey" PRIMARY KEY ("buried_person_id")
);

-- CreateTable
CREATE TABLE "work_infos" (
    "work_info_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "company_name" VARCHAR(100) NOT NULL,
    "company_name_kana" VARCHAR(100) NOT NULL,
    "work_address" VARCHAR(200) NOT NULL,
    "work_postal_code" VARCHAR(8) NOT NULL,
    "work_phone_number" VARCHAR(15) NOT NULL,
    "dm_setting" VARCHAR(20) NOT NULL,
    "address_type" VARCHAR(20) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "work_infos_pkey" PRIMARY KEY ("work_info_id")
);

-- CreateTable
CREATE TABLE "billing_infos" (
    "billing_info_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "billing_type" VARCHAR(20) NOT NULL,
    "bank_name" VARCHAR(100) NOT NULL,
    "branch_name" VARCHAR(100) NOT NULL,
    "account_type" VARCHAR(20) NOT NULL,
    "account_number" VARCHAR(50) NOT NULL,
    "account_holder" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "billing_infos_pkey" PRIMARY KEY ("billing_info_id")
);

-- CreateTable
CREATE TABLE "histories" (
    "history_id" TEXT NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" VARCHAR(255) NOT NULL,
    "plot_id" TEXT,
    "action_type" VARCHAR(20) NOT NULL,
    "changed_fields" JSONB,
    "changed_by" VARCHAR(100),
    "change_reason" VARCHAR(200),
    "ip_address" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "histories_pkey" PRIMARY KEY ("history_id")
);

-- CreateTable
CREATE TABLE "staff" (
    "staff_id" SERIAL NOT NULL,
    "supabase_uid" VARCHAR(255),
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "role" VARCHAR(20) NOT NULL DEFAULT 'viewer',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("staff_id")
);

-- CreateTable
CREATE TABLE "usage_status_master" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(200),
    "sort_order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_status_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cemetery_type_master" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(200),
    "sort_order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cemetery_type_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "denomination_master" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(200),
    "sort_order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "denomination_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gender_master" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(200),
    "sort_order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gender_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_method_master" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(200),
    "sort_order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_method_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_type_master" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "tax_rate" DECIMAL(5,2),
    "description" VARCHAR(200),
    "sort_order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_type_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calc_type_master" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(200),
    "sort_order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calc_type_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_type_master" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(200),
    "sort_order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_type_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_type_master" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(200),
    "sort_order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_type_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipient_type_master" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(200),
    "sort_order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recipient_type_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relation_master" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(200),
    "sort_order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relation_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "construction_type_master" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(200),
    "sort_order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "construction_type_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "update_type_master" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(200),
    "sort_order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "update_type_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prefecture_master" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(2) NOT NULL,
    "name" VARCHAR(10) NOT NULL,
    "name_kana" VARCHAR(20),
    "sort_order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "prefecture_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collective_burials" (
    "collective_burial_id" TEXT NOT NULL,
    "physical_plot_id" TEXT NOT NULL,
    "burial_capacity" INTEGER NOT NULL,
    "current_burial_count" INTEGER NOT NULL DEFAULT 0,
    "capacity_reached_date" DATE,
    "validity_period_years" INTEGER NOT NULL,
    "billing_scheduled_date" DATE,
    "billing_status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "billing_amount" DECIMAL(15,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "collective_burials_pkey" PRIMARY KEY ("collective_burial_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "physical_plots_plot_number_key" ON "physical_plots"("plot_number");

-- CreateIndex
CREATE INDEX "physical_plots_plot_number_idx" ON "physical_plots"("plot_number");

-- CreateIndex
CREATE INDEX "physical_plots_area_name_idx" ON "physical_plots"("area_name");

-- CreateIndex
CREATE INDEX "physical_plots_status_idx" ON "physical_plots"("status");

-- CreateIndex
CREATE INDEX "physical_plots_deleted_at_idx" ON "physical_plots"("deleted_at");

-- CreateIndex
CREATE INDEX "contract_plots_physical_plot_id_idx" ON "contract_plots"("physical_plot_id");

-- CreateIndex
CREATE INDEX "contract_plots_sale_status_idx" ON "contract_plots"("sale_status");

-- CreateIndex
CREATE INDEX "contract_plots_deleted_at_idx" ON "contract_plots"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "sale_contracts_contract_plot_id_key" ON "sale_contracts"("contract_plot_id");

-- CreateIndex
CREATE INDEX "sale_contracts_contract_plot_id_idx" ON "sale_contracts"("contract_plot_id");

-- CreateIndex
CREATE INDEX "sale_contracts_customer_id_idx" ON "sale_contracts"("customer_id");

-- CreateIndex
CREATE INDEX "sale_contracts_contract_date_idx" ON "sale_contracts"("contract_date");

-- CreateIndex
CREATE INDEX "sale_contracts_payment_status_idx" ON "sale_contracts"("payment_status");

-- CreateIndex
CREATE INDEX "sale_contracts_deleted_at_idx" ON "sale_contracts"("deleted_at");

-- CreateIndex
CREATE INDEX "customers_name_name_kana_idx" ON "customers"("name", "name_kana");

-- CreateIndex
CREATE INDEX "customers_phone_number_idx" ON "customers"("phone_number");

-- CreateIndex
CREATE INDEX "customers_email_idx" ON "customers"("email");

-- CreateIndex
CREATE INDEX "customers_deleted_at_idx" ON "customers"("deleted_at");

-- CreateIndex
CREATE INDEX "family_contacts_physical_plot_id_idx" ON "family_contacts"("physical_plot_id");

-- CreateIndex
CREATE UNIQUE INDEX "emergency_contacts_physical_plot_id_key" ON "emergency_contacts"("physical_plot_id");

-- CreateIndex
CREATE INDEX "emergency_contacts_physical_plot_id_idx" ON "emergency_contacts"("physical_plot_id");

-- CreateIndex
CREATE INDEX "buried_persons_physical_plot_id_idx" ON "buried_persons"("physical_plot_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_infos_customer_id_key" ON "work_infos"("customer_id");

-- CreateIndex
CREATE INDEX "work_infos_customer_id_idx" ON "work_infos"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_infos_customer_id_key" ON "billing_infos"("customer_id");

-- CreateIndex
CREATE INDEX "billing_infos_customer_id_idx" ON "billing_infos"("customer_id");

-- CreateIndex
CREATE INDEX "histories_entity_type_entity_id_idx" ON "histories"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "histories_plot_id_idx" ON "histories"("plot_id");

-- CreateIndex
CREATE INDEX "histories_created_at_idx" ON "histories"("created_at");

-- CreateIndex
CREATE INDEX "histories_changed_by_idx" ON "histories"("changed_by");

-- CreateIndex
CREATE UNIQUE INDEX "staff_supabase_uid_key" ON "staff"("supabase_uid");

-- CreateIndex
CREATE UNIQUE INDEX "staff_email_key" ON "staff"("email");

-- CreateIndex
CREATE INDEX "staff_email_idx" ON "staff"("email");

-- CreateIndex
CREATE INDEX "staff_supabase_uid_idx" ON "staff"("supabase_uid");

-- CreateIndex
CREATE INDEX "staff_role_is_active_idx" ON "staff"("role", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "usage_status_master_code_key" ON "usage_status_master"("code");

-- CreateIndex
CREATE UNIQUE INDEX "cemetery_type_master_code_key" ON "cemetery_type_master"("code");

-- CreateIndex
CREATE UNIQUE INDEX "denomination_master_code_key" ON "denomination_master"("code");

-- CreateIndex
CREATE UNIQUE INDEX "gender_master_code_key" ON "gender_master"("code");

-- CreateIndex
CREATE UNIQUE INDEX "payment_method_master_code_key" ON "payment_method_master"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tax_type_master_code_key" ON "tax_type_master"("code");

-- CreateIndex
CREATE UNIQUE INDEX "calc_type_master_code_key" ON "calc_type_master"("code");

-- CreateIndex
CREATE UNIQUE INDEX "billing_type_master_code_key" ON "billing_type_master"("code");

-- CreateIndex
CREATE UNIQUE INDEX "account_type_master_code_key" ON "account_type_master"("code");

-- CreateIndex
CREATE UNIQUE INDEX "recipient_type_master_code_key" ON "recipient_type_master"("code");

-- CreateIndex
CREATE UNIQUE INDEX "relation_master_code_key" ON "relation_master"("code");

-- CreateIndex
CREATE UNIQUE INDEX "construction_type_master_code_key" ON "construction_type_master"("code");

-- CreateIndex
CREATE UNIQUE INDEX "update_type_master_code_key" ON "update_type_master"("code");

-- CreateIndex
CREATE UNIQUE INDEX "prefecture_master_code_key" ON "prefecture_master"("code");

-- CreateIndex
CREATE UNIQUE INDEX "collective_burials_physical_plot_id_key" ON "collective_burials"("physical_plot_id");

-- CreateIndex
CREATE INDEX "collective_burials_physical_plot_id_idx" ON "collective_burials"("physical_plot_id");

-- CreateIndex
CREATE INDEX "collective_burials_billing_status_idx" ON "collective_burials"("billing_status");

-- CreateIndex
CREATE INDEX "collective_burials_billing_scheduled_date_idx" ON "collective_burials"("billing_scheduled_date");

-- AddForeignKey
ALTER TABLE "contract_plots" ADD CONSTRAINT "contract_plots_physical_plot_id_fkey" FOREIGN KEY ("physical_plot_id") REFERENCES "physical_plots"("physical_plot_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_contracts" ADD CONSTRAINT "sale_contracts_contract_plot_id_fkey" FOREIGN KEY ("contract_plot_id") REFERENCES "contract_plots"("contract_plot_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_contracts" ADD CONSTRAINT "sale_contracts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_contacts" ADD CONSTRAINT "family_contacts_physical_plot_id_fkey" FOREIGN KEY ("physical_plot_id") REFERENCES "physical_plots"("physical_plot_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_contacts" ADD CONSTRAINT "emergency_contacts_physical_plot_id_fkey" FOREIGN KEY ("physical_plot_id") REFERENCES "physical_plots"("physical_plot_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buried_persons" ADD CONSTRAINT "buried_persons_physical_plot_id_fkey" FOREIGN KEY ("physical_plot_id") REFERENCES "physical_plots"("physical_plot_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_infos" ADD CONSTRAINT "work_infos_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_infos" ADD CONSTRAINT "billing_infos_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collective_burials" ADD CONSTRAINT "collective_burials_physical_plot_id_fkey" FOREIGN KEY ("physical_plot_id") REFERENCES "physical_plots"("physical_plot_id") ON DELETE CASCADE ON UPDATE CASCADE;
