-- 解約済み（取引終了）顧客フラグ（#129）
-- 業務確認（2026-06-07 Q21）: レガシー t_danka.del_flg=2 の終了顧客を「終了」印付きで取り込む
ALTER TABLE "customers" ADD COLUMN "is_terminated" BOOLEAN NOT NULL DEFAULT false;
