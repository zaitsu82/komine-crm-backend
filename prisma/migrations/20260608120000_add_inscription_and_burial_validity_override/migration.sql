-- 碑文（注意書きの一言・一覧表示用）: ContractPlot に追加（komine-docs#10 項目1）
-- 墓誌(gravestone_inscription)とは別物。一覧で一目で見やすい注意書きの一言。
ALTER TABLE "contract_plots" ADD COLUMN "inscription" VARCHAR(120);

-- 合祀年数の個別上書き: BuriedPerson に追加（komine-docs#10 項目8）
-- null=区画の合祀年数(contract_plots.validity_period_years)を継承。人によって短くする運用に対応。
ALTER TABLE "buried_persons" ADD COLUMN "validity_period_years_override" INTEGER;
