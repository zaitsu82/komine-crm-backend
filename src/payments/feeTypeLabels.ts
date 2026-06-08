/**
 * 入金(payments)の料金種別ラベル解決（#334）
 *
 * レガシー移行（scripts/legacy-migration/steps/11-payment.ts）で payments.fee_type には
 * `legacy-fee-20230001` / `legacy-fee-20230002` というセンチネル文字列が入っている。
 * 業務確認（komine-docs#10）で以下と確定したため、表示時に日本語ラベルへ変換する:
 *   - 20230001 = 使用料
 *   - 20230002 = 管理料
 *
 * fee_type はマスタFKではなく自由文字列カラムのため、生データ（センチネル）は保持したまま
 * 読み取り時（DTO化）にのみラベル解決する。新規入金で入った非レガシー値はそのまま返す。
 */
export const LEGACY_PAYMENT_FEE_TYPE_LABELS: Record<string, string> = {
  'legacy-fee-20230001': '使用料',
  'legacy-fee-20230002': '管理料',
};

/**
 * payments.fee_type を表示用ラベルへ解決する。
 * - 既知のレガシーセンチネル → 日本語ラベル
 * - それ以外（新規入金値・null）→ そのまま
 */
export function resolvePaymentFeeTypeLabel(feeType: string | null | undefined): string | null {
  if (feeType == null) return null;
  return LEGACY_PAYMENT_FEE_TYPE_LABELS[feeType] ?? feeType;
}
