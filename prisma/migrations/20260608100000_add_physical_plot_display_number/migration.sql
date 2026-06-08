-- 表示用区画番号 display_number を追加（#158）
-- plot_number はユニークキー兼一括取込キーで legacy-{grave_cd} のまま維持し、
-- レガシー grave_name_cd 由来の表示用番号（例: "A-100"）を非ユニーク列として保持する。
ALTER TABLE "physical_plots" ADD COLUMN "display_number" VARCHAR(100);
