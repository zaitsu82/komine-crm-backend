-- 参考画面とWebアプリの画面項目差異の解消 (komine-docs #4)

-- BuriedPerson: 生年月日、戒名、届出日、宗派
ALTER TABLE "buried_persons" ADD COLUMN "birth_date" DATE;
ALTER TABLE "buried_persons" ADD COLUMN "posthumous_name" VARCHAR(200);
ALTER TABLE "buried_persons" ADD COLUMN "report_date" DATE;
ALTER TABLE "buried_persons" ADD COLUMN "religion" VARCHAR(50);

-- FamilyContact: かな、電話番号2、勤務先情報、連絡区分
ALTER TABLE "family_contacts" ADD COLUMN "name_kana" VARCHAR(100);
ALTER TABLE "family_contacts" ADD COLUMN "phone_number_2" VARCHAR(15);
ALTER TABLE "family_contacts" ADD COLUMN "work_company_name" VARCHAR(100);
ALTER TABLE "family_contacts" ADD COLUMN "work_company_name_kana" VARCHAR(100);
ALTER TABLE "family_contacts" ADD COLUMN "work_address" VARCHAR(200);
ALTER TABLE "family_contacts" ADD COLUMN "work_phone_number" VARCHAR(15);
ALTER TABLE "family_contacts" ADD COLUMN "contact_method" VARCHAR(50);

-- ConstructionInfo: 終了予定日、工事内容
ALTER TABLE "construction_infos" ADD COLUMN "scheduled_end_date" DATE;
ALTER TABLE "construction_infos" ADD COLUMN "construction_content" TEXT;

-- Customer: 住所2
ALTER TABLE "customers" ADD COLUMN "address_line_2" VARCHAR(200);

-- ContractPlot: 受付日、担当者
ALTER TABLE "contract_plots" ADD COLUMN "acceptance_date" DATE;
ALTER TABLE "contract_plots" ADD COLUMN "staff_in_charge" VARCHAR(100);

-- GravestoneInfo: 墓石代
ALTER TABLE "gravestone_infos" ADD COLUMN "gravestone_cost" INTEGER;
