-- #324: レガシー履歴（t_dankalog / t_famlog）→ History 取込の冪等キーを追加。
-- 各ログ行の PK（danka_log_cd / family_log_id）をテーブル名と組で一意にし、
-- 再実行時の重複INSERTを防ぐ（billing/payment の legacy_*_cd と同形の冪等パターン）。

-- AlterTable
ALTER TABLE "histories" ADD COLUMN "legacy_log_cd" INTEGER;
ALTER TABLE "histories" ADD COLUMN "legacy_log_table" VARCHAR(20);

-- CreateIndex
CREATE UNIQUE INDEX "histories_legacy_log_table_legacy_log_cd_key" ON "histories"("legacy_log_table", "legacy_log_cd");
