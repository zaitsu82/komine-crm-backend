-- #220/#221: レガシー移行の冪等キーと申込者識別カラムを追加
-- FamilyContact / BuriedPerson / ConstructionInfo はレガシー自然キーを保持して
-- 再実行時の重複INSERTを防ぎ（billing/payment の legacy_*_cd と同形）、
-- Customer は申込者（契約者と別人）として作成された行を識別できるようにする。

-- AlterTable
ALTER TABLE "family_contacts" ADD COLUMN "legacy_family_cd" INTEGER;

-- AlterTable
ALTER TABLE "buried_persons" ADD COLUMN "legacy_maisou_cd" INTEGER;

-- AlterTable
ALTER TABLE "construction_infos" ADD COLUMN "legacy_construction_id" INTEGER;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN "legacy_applicant_danka_cd" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "family_contacts_legacy_family_cd_key" ON "family_contacts"("legacy_family_cd");

-- CreateIndex
CREATE UNIQUE INDEX "buried_persons_legacy_maisou_cd_key" ON "buried_persons"("legacy_maisou_cd");

-- CreateIndex
CREATE UNIQUE INDEX "construction_infos_legacy_construction_id_key" ON "construction_infos"("legacy_construction_id");
