-- CreateTable
CREATE TABLE "direction_master" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(200),
    "sort_order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "direction_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position_master" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "description" VARCHAR(200),
    "sort_order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "position_master_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "direction_master_code_key" ON "direction_master"("code");

-- CreateIndex
CREATE UNIQUE INDEX "position_master_code_key" ON "position_master"("code");

-- InsertData: 方角 (レガシー sykbnn KBNNO=2024)。code はレガシー houi_id の文字列。
INSERT INTO "direction_master" ("code", "name", "sort_order", "updated_at") VALUES
('1', '東',   1, NOW()),
('2', '西',   2, NOW()),
('3', '南',   3, NOW()),
('4', '北',   4, NOW()),
('5', '北東', 5, NOW()),
('6', '南東', 6, NOW()),
('7', '北西', 7, NOW()),
('8', '南西', 8, NOW());

-- InsertData: 位置 (レガシー sykbnn KBNNO=2025)。code はレガシー ichi_id の文字列。
INSERT INTO "position_master" ("code", "name", "sort_order", "updated_at") VALUES
('1', '角', 1, NOW()),
('2', '端', 2, NOW()),
('3', '中', 3, NOW());
