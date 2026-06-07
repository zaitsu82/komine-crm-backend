-- 家族連絡先の契約区画リンクを nullable 化（#311）
-- 業務確認（2026-06-07 Q18/Q20/Q21）: 解約者（is_terminated 顧客）に紐づく
-- t_family 91件は契約区画を持たないため、customer_id 直リンクのみで取り込む
ALTER TABLE "family_contacts" ALTER COLUMN "contract_plot_id" DROP NOT NULL;
