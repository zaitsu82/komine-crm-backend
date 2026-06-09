-- Customer にゆうちょ記号(5桁)・番号フィールドを追加する（#170）
--
-- 背景:
--   ゆうちょ自動払込CSVの店番は、これまで支店名(branch_name)から漢数字/数字を推定して
--   採番しており、不明時は 000 になっていた（src/yucho/yuchoCsv.ts extractBranchCode）。
--   ゆうちょの記号番号方式（記号 = 1 + 店番3桁 + 預金種目1桁、番号 = 口座番号）を
--   正しく保持できるよう、記号・番号を Customer に持たせる。
--   変換ロジックは src/yucho/yuchoAccount.ts に集約し、CSV と表示で同一ロジックを使う。
--
-- いずれも nullable。既存データは null（未入力）。新システムで入力していく。
ALTER TABLE "customers" ADD COLUMN "yucho_symbol" VARCHAR(5);
ALTER TABLE "customers" ADD COLUMN "yucho_number" VARCHAR(20);
