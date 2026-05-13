import { PrismaClient } from '@prisma/client';
import type { Logger } from 'pino';

import type { IdMaps } from './idMap';

export interface MigrationContext {
  prisma: PrismaClient;
  logger: Logger;
  idMaps: IdMaps;
  /** dry-run: Prisma への書き込みを行わない（ID マップは仮 UUID で埋める） */
  dryRun: boolean;
}

export interface MigrationStep {
  name: string;
  /** 依存ステップ名（このステップ前に完了している必要があるもの） */
  dependsOn?: string[];
  run: (ctx: MigrationContext) => Promise<MigrationStepResult>;
}

export interface MigrationStepResult {
  /** 取り込んだレコード数 */
  inserted: number;
  /** スキップしたレコード数（del_flg、異常値など） */
  skipped: number;
  /** その他の備考メトリクス */
  notes?: Record<string, number | string>;
}
