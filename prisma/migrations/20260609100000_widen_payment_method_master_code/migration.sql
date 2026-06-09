-- payment_method_master.code を VarChar(10) → VarChar(20) に拡張する（#331）
--
-- 背景:
--   seedMasters の正準コード ACCOUNT_TRANSFER(16字) / BANK_TRANSFER(13字) が VarChar(10) に収まらず、
--   `npm run seed:masters` が payment_method の createMany で "value too long" で失敗していた。
--   これにより後続の calc/tax/billing マスタ投入にも到達できず、料金区分の「旧コード」表示(#331)が
--   解消できなかった。code 列を 20 に拡張して seed を完走できるようにする。
--   （contractor_master / section_name_master は既に VarChar(20)）
ALTER TABLE "payment_method_master" ALTER COLUMN "code" TYPE VARCHAR(20);
