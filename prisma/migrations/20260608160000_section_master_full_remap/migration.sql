-- 区画名マスタ（section_name_master）を本番実データの全区画名にそろえる（#166）
--
-- 背景:
--   #151 で PhysicalPlot.area_name は m_area.area_name（実区画名: 凛A/つながり/樹林/A〜P/数字 等）に
--   確定したが、初期 seed（20260401000000）は 2025/10 区画残数エクセル由来の 40 区画分しか無く、
--   本番に実在する 凛A〜D・つながり・樹木葬・桜シェア葬・千年桜・るり庵/Ⅱ/ガーデン・納骨堂系・
--   吉相C/吉相テラス が期へマップできず、区画残数の期別サマリーが機能していなかった。
--
--   さらに初期 seed の第4期は実データに無い区画名（"1.5"/"2.4"/"3"/"4"/"5"/"8.4" は
--   実際には「つながり」区画の grave_name_cd 接頭辞、"3"/"4"/"5" は第2期と重複）を持っており、
--   期判定の取り違えを生んでいた。これらを除去する。
--
-- 期の割当は業務確認済み（2026-06-08）:
--   凛A〜D・つながり・るり庵/Ⅱ/ガーデン・納骨堂系 → 第4期
--   樹木葬・桜シェア葬C/E/F・千年桜 → 第3期樹林部
--   吉相C・吉相テラス → 第1期

-- 1) 取り違えの原因になっていた初期 seed の第4期エントリを除去
--    （"1.5"/"2.4"/"8.4" は接頭辞、"3"/"4"/"5" は第2期と重複、るり庵テラスⅡは実名 "るり庵Ⅱ" で再登録）
DELETE FROM "section_name_master"
 WHERE "code" IN ('4-1.5', '4-2.4', '4-3', '4-4', '4-5', '4-8.4', '4-RURIAN_TERRACE2');

-- 2) 本番実データに存在する区画名を期付きで投入（再実行安全: ON CONFLICT で更新）
INSERT INTO "section_name_master" ("code", "name", "period", "sort_order", "updated_at") VALUES
  -- 第1期（吉相系の追加区画）
  ('1-KISSOU_C',        '吉相C',        '第1期',       41, NOW()),
  ('1-KISSOU_TERRACE',  '吉相テラス',   '第1期',       42, NOW()),
  -- 第3期樹林部（樹木葬・自然葬系）
  ('3T-JUMOKU',         '樹木葬',       '第3期樹林部', 43, NOW()),
  ('3T-SAKURA_C',       '桜シェア葬C',  '第3期樹林部', 44, NOW()),
  ('3T-SAKURA_E',       '桜シェア葬E',  '第3期樹林部', 45, NOW()),
  ('3T-SAKURA_F',       '桜シェア葬F',  '第3期樹林部', 46, NOW()),
  ('3T-SENNEN',         '千年桜',       '第3期樹林部', 47, NOW()),
  -- 第4期（凛・つながり・るり庵・納骨堂系）
  ('4-TSUNAGARI',       'つながり',     '第4期',       48, NOW()),
  ('4-RIN_A',           '凛A',          '第4期',       49, NOW()),
  ('4-RIN_B',           '凛B',          '第4期',       50, NOW()),
  ('4-RIN_C',           '凛C',          '第4期',       51, NOW()),
  ('4-RIN_D',           '凛D',          '第4期',       52, NOW()),
  ('4-RURIAN',          'るり庵',       '第4期',       53, NOW()),
  ('4-RURIAN_II',       'るり庵Ⅱ',      '第4期',       54, NOW()),
  ('4-RURIAN_GARDEN',   'るり庵ガーデン', '第4期',     55, NOW()),
  ('4-NOUKOTSU_TENKU',  '納骨堂-天空',  '第4期',       56, NOW()),
  ('4-NOUKOTSU_AMIDA',  '納骨堂-阿弥陀', '第4期',      57, NOW()),
  ('4-NOUKOTSU_MIROKU', '納骨堂-弥勒',  '第4期',       58, NOW()),
  ('4-NOUKOTSU_FUDOU',  '納骨堂-不動',  '第4期',       59, NOW()),
  ('4-NOUKOTSU_JIZOU',  '納骨堂-地蔵',  '第4期',       60, NOW())
ON CONFLICT ("code") DO UPDATE
  SET "name"       = EXCLUDED."name",
      "period"     = EXCLUDED."period",
      "sort_order" = EXCLUDED."sort_order",
      "is_active"  = true,
      "updated_at" = NOW();
