/// <reference types="node" />
/**
 * 全 ContractPlot の payment_status / uncollected_amount 再計算スクリプト（#389）
 *
 * `uncollected_amount` は請求 vs 入金の派生値（#170）で、ランタイムは請求/入金の
 * ミューテーション経路でのみ再計算する（src/plots/services/paymentStatusService）。
 * このため定義変更（PR#328: 未収金額を「全料金区分」→「護持費=管理料限定」へ絞り込み）が
 * 既存の格納値に再適用されず、請求/入金を一度も触らない区画は旧定義の金額を表示し続ける。
 *
 * 本スクリプトは **レガシーDB不要**（Prisma 単独）で、全 ContractPlot を
 * 請求群から再集計し、payment_status / uncollected_amount を現行定義へ収束させる。
 * 判定は migrate:legacy の step12-payment-status と同じ deriveContractPlotPayment を共有する。
 *
 * 使い方:
 *   npm run recalc:payment-status              # dry-run（差分件数のみ・更新なし）
 *   npm run recalc:payment-status -- --apply   # 実際に更新
 *
 * 環境変数: DATABASE_URL のみ（レガシー接続不要）
 *
 * 冪等: 現行定義に収束した区画は次回 no-op。何度実行しても同じ結果になる。
 */
import 'dotenv/config';

import type { BillingCategory, PaymentStatus } from '@prisma/client';

import { prisma } from '../src/db/prisma';
import { deriveContractPlotPayment } from '../src/plots/services/paymentStatusLogic';

const APPLY = process.argv.includes('--apply');
const CHUNK = 1000;

type GroupedBilling = {
  contract_plot_id: string;
  category: BillingCategory;
  _sum: { amount: number | null; paid_amount: number | null };
};

type CurrentPlot = {
  id: string;
  payment_status: PaymentStatus;
  uncollected_amount: number;
};

export interface RecalcPlan {
  /** 再計算後の (status, uncollected) 別に更新対象 ID をまとめたバケット群 */
  buckets: Map<string, { status: PaymentStatus; uncollected: number; ids: string[] }>;
  scanned: number;
  changed: number;
  noop: number;
}

/**
 * 区画ごとの現在値と請求集計から「現行定義へ収束させるための更新計画」を組む（DB 非依存の純関数）。
 *
 * - 請求の無い区画も対象に含める: 旧定義で uncollected>0 が格納されたまま請求/入金が無い区画を
 *   0 へ戻す必要があるため。請求が無い区画は status を現状維持し uncollected=0 を期待値とする。
 * - 現在値と期待値が一致する区画は no-op（更新対象から除外）。
 */
export function buildRecalcPlan(plots: CurrentPlot[], grouped: GroupedBilling[]): RecalcPlan {
  const byPlot = new Map<
    string,
    { amount: number; paid_amount: number; terminated: boolean; category: BillingCategory }[]
  >();
  for (const g of grouped) {
    const list = byPlot.get(g.contract_plot_id) ?? [];
    list.push({
      amount: g._sum.amount ?? 0,
      paid_amount: g._sum.paid_amount ?? 0,
      terminated: false, // groupBy 側で terminated:false 済み
      category: g.category,
    });
    byPlot.set(g.contract_plot_id, list);
  }

  const buckets = new Map<string, { status: PaymentStatus; uncollected: number; ids: string[] }>();
  let changed = 0;
  let noop = 0;

  for (const plot of plots) {
    const billings = byPlot.get(plot.id) ?? [];
    // 現在の payment_status は手動設定（refunded/overdue）を尊重するため derive に渡す。
    const { status, uncollectedAmount: uncollected } = deriveContractPlotPayment(
      billings,
      plot.payment_status
    );

    if (status === plot.payment_status && uncollected === plot.uncollected_amount) {
      noop += 1;
      continue;
    }
    changed += 1;

    const key = `${status}|${uncollected}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.ids.push(plot.id);
    else buckets.set(key, { status, uncollected, ids: [plot.id] });
  }

  return { buckets, scanned: plots.length, changed, noop };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main(): Promise<void> {
  console.log(`[recalc payment-status] start (apply=${APPLY})`);

  // 全 active 区画の現在値
  const plots = await prisma.contractPlot.findMany({
    where: { deleted_at: null },
    select: { id: true, payment_status: true, uncollected_amount: true },
  });

  // 解約済み・削除済みを除いた請求を「区画 × category」で集計
  const grouped = (await prisma.billing.groupBy({
    by: ['contract_plot_id', 'category'],
    where: { deleted_at: null, terminated: false },
    _sum: { amount: true, paid_amount: true },
  })) as GroupedBilling[];

  const plan = buildRecalcPlan(plots, grouped);

  if (!APPLY) {
    const sample: Array<{ status: PaymentStatus; uncollected: number; ids: number }> = [];
    for (const b of plan.buckets.values()) {
      sample.push({ status: b.status, uncollected: b.uncollected, ids: b.ids.length });
    }
    console.log(
      JSON.stringify(
        {
          dryRun: true,
          scanned: plan.scanned,
          would_change: plan.changed,
          noop: plan.noop,
          buckets: sample.slice(0, 20),
        },
        null,
        2
      )
    );
    return;
  }

  let updated = 0;
  for (const { status, uncollected, ids } of plan.buckets.values()) {
    for (const idChunk of chunk(ids, CHUNK)) {
      await prisma.contractPlot.updateMany({
        where: { id: { in: idChunk }, deleted_at: null },
        data: { payment_status: status, uncollected_amount: uncollected },
      });
      updated += idChunk.length;
      if (updated % 1000 === 0 || updated === plan.changed) {
        console.log(`  updated ${updated}/${plan.changed}`);
      }
    }
  }

  console.log(
    JSON.stringify(
      { scanned: plan.scanned, changed: plan.changed, noop: plan.noop, updated },
      null,
      2
    )
  );
}

// テストから import されたとき（require.main 不一致）は自動実行しない。
if (require.main === module) {
  main()
    .catch((e) => {
      console.error('ERROR', e);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
