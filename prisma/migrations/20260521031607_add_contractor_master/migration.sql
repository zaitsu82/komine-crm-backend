-- CreateTable
CREATE TABLE "contractor_master" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(200),
    "sort_order" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contractor_master_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contractor_master_code_key" ON "contractor_master"("code");

-- InsertData: 業者名は業務側に未確認のため暫定の代表値のみ投入。
-- 実際の業者一覧が確定したら is_active を false にして新規 INSERT する想定。
INSERT INTO "contractor_master" ("code", "name", "sort_order", "updated_at") VALUES
('placeholder-1',  '小嶺石材',       1, NOW()),
('placeholder-2',  '小嶺霊園工事部', 2, NOW()),
('placeholder-3',  '提携業者A',      3, NOW()),
('placeholder-4',  '提携業者B',      4, NOW()),
('placeholder-99', 'その他',         99, NOW());
