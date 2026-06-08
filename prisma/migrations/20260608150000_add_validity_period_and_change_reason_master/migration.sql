-- #343/#344: 合祀年数マスタ・変更履歴理由マスタを追加（業務確認シート Q17/Q16）

-- CreateTable
CREATE TABLE "validity_period_master" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(200),
    "sort_order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "validity_period_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_reason_master" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(200),
    "sort_order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "change_reason_master_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "validity_period_master_code_key" ON "validity_period_master"("code");
CREATE UNIQUE INDEX "change_reason_master_code_key" ON "change_reason_master"("code");

-- Seed: 合祀年数（13/15/24/33）
INSERT INTO "validity_period_master" ("code", "name", "sort_order", "updated_at") VALUES
  ('13', '13年', 13, CURRENT_TIMESTAMP),
  ('15', '15年', 15, CURRENT_TIMESTAMP),
  ('24', '24年', 24, CURRENT_TIMESTAMP),
  ('33', '33年', 33, CURRENT_TIMESTAMP);

-- Seed: 変更理由（名義変更/住所変更/電話番号変更/解約/合祀/修理/字彫/備品購入/その他）
INSERT INTO "change_reason_master" ("code", "name", "sort_order", "updated_at") VALUES
  ('meigi', '名義変更', 1, CURRENT_TIMESTAMP),
  ('jusho', '住所変更', 2, CURRENT_TIMESTAMP),
  ('tel', '電話番号変更', 3, CURRENT_TIMESTAMP),
  ('kaiyaku', '解約', 4, CURRENT_TIMESTAMP),
  ('goushi', '合祀', 5, CURRENT_TIMESTAMP),
  ('shuri', '修理', 6, CURRENT_TIMESTAMP),
  ('jibori', '字彫', 7, CURRENT_TIMESTAMP),
  ('bihin', '備品購入', 8, CURRENT_TIMESTAMP),
  ('other', 'その他', 9, CURRENT_TIMESTAMP);
