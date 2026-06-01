/**
 * Prisma 用の DATABASE_URL を解決する。
 *
 * 本番 (ECS/Fargate) では Secrets Manager の DB 認証情報が `DB_HOST` / `DB_PORT` /
 * `DB_USERNAME` / `DB_PASSWORD` / `DB_NAME` として **個別に** 注入される一方、Prisma
 * (`PrismaPg`) は単一の接続文字列 `DATABASE_URL` を必要とする。
 *
 * - `DATABASE_URL` が直接与えられていればそれをそのまま使う（ローカル / .env / 既存運用）。
 * - 無ければ個別の `DB_*` から組み立てる（ECS のように分割注入される環境向け）。
 *
 * ユーザー名・パスワードは接続文字列を壊す文字（`@` `:` `/` `?` 等）を含み得るため、
 * `encodeURIComponent` でパーセントエンコードしてから埋め込む。
 *
 * @param env 参照する環境変数（テスト用に差し替え可能。既定は `process.env`）
 * @returns 解決した接続文字列。組み立てに必要な値が揃わない場合は `undefined`。
 */
export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const direct = env['DATABASE_URL'];
  if (direct && direct.trim() !== '') {
    return direct;
  }

  const host = env['DB_HOST'];
  const username = env['DB_USERNAME'];
  const password = env['DB_PASSWORD'];
  const dbName = env['DB_NAME'];

  // host / username / dbName が揃わなければ組み立て不可（呼び出し側で接続エラーになる）
  if (!host || !username || !dbName) {
    return undefined;
  }

  const port = env['DB_PORT'] ?? '5432';
  const user = encodeURIComponent(username);
  const auth = password ? `${user}:${encodeURIComponent(password)}` : user;

  return `postgresql://${auth}@${host}:${port}/${dbName}`;
}
