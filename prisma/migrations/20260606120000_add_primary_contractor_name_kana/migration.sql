-- 主契約者カナのスナップショット列を追加（#282）
-- 契約者名ソート（sortBy=customerName）が全件ロード＋アプリ側ソートだったのを
-- DB 側 orderBy + take のページングに置き換えるための非正規化列。
-- 値は「最初の有効な contractor ロールの customer.name_kana || name」。

-- AlterTable
ALTER TABLE "contract_plots" ADD COLUMN     "primary_contractor_name_kana" VARCHAR(100);

-- CreateIndex
CREATE INDEX "contract_plots_primary_contractor_name_kana_idx" ON "contract_plots"("primary_contractor_name_kana");

-- Backfill: 既存契約の主契約者カナを同期
UPDATE "contract_plots" cp
SET "primary_contractor_name_kana" = sub.kana
FROM (
  SELECT DISTINCT ON (scr."contract_plot_id")
         scr."contract_plot_id" AS contract_plot_id,
         COALESCE(NULLIF(c."name_kana", ''), c."name") AS kana
  FROM "sale_contract_roles" scr
  JOIN "customers" c ON c."customer_id" = scr."customer_id"
  WHERE scr."role" = 'contractor'
    AND scr."deleted_at" IS NULL
  ORDER BY scr."contract_plot_id", scr."created_at" ASC, scr."sale_contract_role_id" ASC
) sub
WHERE cp."contract_plot_id" = sub.contract_plot_id;
