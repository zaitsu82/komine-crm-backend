-- CreateTable
CREATE TABLE "section_name_master" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "period" VARCHAR(20) NOT NULL,
    "description" VARCHAR(200),
    "sort_order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "section_name_master_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "section_name_master_code_key" ON "section_name_master"("code");

-- InsertData: 第1期 (17区画)
INSERT INTO "section_name_master" ("code", "name", "period", "sort_order", "updated_at") VALUES
('1-A',  'A',  '第1期', 1,  NOW()),
('1-B',  'B',  '第1期', 2,  NOW()),
('1-C',  'C',  '第1期', 3,  NOW()),
('1-KISSOU', '吉相', '第1期', 4, NOW()),
('1-D',  'D',  '第1期', 5,  NOW()),
('1-E',  'E',  '第1期', 6,  NOW()),
('1-F',  'F',  '第1期', 7,  NOW()),
('1-G',  'G',  '第1期', 8,  NOW()),
('1-H',  'H',  '第1期', 9,  NOW()),
('1-I',  'I',  '第1期', 10, NOW()),
('1-J',  'J',  '第1期', 11, NOW()),
('1-K',  'K',  '第1期', 12, NOW()),
('1-L',  'L',  '第1期', 13, NOW()),
('1-M',  'M',  '第1期', 14, NOW()),
('1-N',  'N',  '第1期', 15, NOW()),
('1-O',  'O',  '第1期', 16, NOW()),
('1-P',  'P',  '第1期', 17, NOW());

-- InsertData: 第2期 (8区画)
INSERT INTO "section_name_master" ("code", "name", "period", "sort_order", "updated_at") VALUES
('2-1', '1', '第2期', 18, NOW()),
('2-2', '2', '第2期', 19, NOW()),
('2-3', '3', '第2期', 20, NOW()),
('2-4', '4', '第2期', 21, NOW()),
('2-5', '5', '第2期', 22, NOW()),
('2-6', '6', '第2期', 23, NOW()),
('2-7', '7', '第2期', 24, NOW()),
('2-8', '8', '第2期', 25, NOW());

-- InsertData: 第3期 (2区画)
INSERT INTO "section_name_master" ("code", "name", "period", "sort_order", "updated_at") VALUES
('3-10', '10', '第3期', 26, NOW()),
('3-11', '11', '第3期', 27, NOW());

-- InsertData: 第3期樹林部 (2区画)
INSERT INTO "section_name_master" ("code", "name", "period", "sort_order", "updated_at") VALUES
('3T-JURIN',   '樹林',  '第3期樹林部', 28, NOW()),
('3T-TENKUK',  '天空K', '第3期樹林部', 29, NOW());

-- InsertData: 第4期 (11区画)
INSERT INTO "section_name_master" ("code", "name", "period", "sort_order", "updated_at") VALUES
('4-RURIAN_TERRACE',   'るり庵テラス',   '第4期', 30, NOW()),
('4-1.5',              '1.5',            '第4期', 31, NOW()),
('4-2.4',              '2.4',            '第4期', 32, NOW()),
('4-3',                '3',              '第4期', 33, NOW()),
('4-4',                '4',              '第4期', 34, NOW()),
('4-5',                '5',              '第4期', 35, NOW()),
('4-8.4',              '8.4',            '第4期', 36, NOW()),
('4-IKOI',             '憩',             '第4期', 37, NOW()),
('4-MEGUMI',           '恵',             '第4期', 38, NOW()),
('4-SOU',              '想',             '第4期', 39, NOW()),
('4-RURIAN_TERRACE2',  'るり庵テラスⅡ', '第4期', 40, NOW());
