import mysql, { Pool, RowDataPacket } from 'mysql2/promise';

import { logger } from './logger';

let pool: Pool | null = null;

export function getLegacyPool(): Pool {
  if (pool) return pool;

  const host = process.env['LEGACY_MYSQL_HOST'];
  const port = Number(process.env['LEGACY_MYSQL_PORT'] ?? 3306);
  const user = process.env['LEGACY_MYSQL_USER'];
  const password = process.env['LEGACY_MYSQL_PASSWORD'] ?? '';
  const database = process.env['LEGACY_MYSQL_DATABASE'];

  if (!host || !user || !database) {
    throw new Error(
      'LEGACY_MYSQL_HOST / LEGACY_MYSQL_USER / LEGACY_MYSQL_DATABASE must be set in .env'
    );
  }

  // レガシー側は Shift_JIS。`charset: 'utf8mb4'` で接続し、サーバ側に
  // `SET NAMES utf8mb4` 相当を発行することで、MySQL が自動的に
  // 内部表現（Shift_JIS）→ utf8mb4 変換した結果を返す
  pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 5,
    dateStrings: true,
  });

  logger.info({ host, port, database }, 'Legacy MySQL pool created');
  return pool;
}

export async function closeLegacyPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Legacy MySQL pool closed');
  }
}

export async function legacyQuery<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const conn = getLegacyPool();
  const [rows] = await conn.query<T[]>(sql, params);
  return rows;
}

export async function legacyCount(
  table: string,
  where = 'del_flg=0 OR del_flg IS NULL'
): Promise<number> {
  const rows = await legacyQuery<RowDataPacket & { cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM \`${table}\` WHERE ${where}`
  );
  return Number(rows[0]?.cnt ?? 0);
}
