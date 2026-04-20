/**
 * 初期管理者ブートストラップスクリプト
 *
 * 顧客環境への初回リリース時に、最初の admin ユーザーを作成する。
 * Supabase Auth にユーザーを作成し、Staff テーブルに admin レコードを登録する。
 *
 * 冪等性: Staff テーブルに admin が1人でも存在すれば skip する。
 *
 * 実行方法:
 *   npm run bootstrap:admin
 *   または
 *   npx prisma db seed
 *
 * 必須環境変数:
 *   INITIAL_ADMIN_EMAIL
 *   INITIAL_ADMIN_PASSWORD
 *   INITIAL_ADMIN_NAME
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   DATABASE_URL
 *
 * オプション:
 *   ALLOW_BOOTSTRAP_IN_PRODUCTION=true — NODE_ENV=production でも実行を許可
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  createSupabaseUserWithPassword,
  deleteSupabaseUser,
  isSupabaseAdminAvailable,
} from '../src/config/supabase';

interface BootstrapEnv {
  email: string;
  password: string;
  name: string;
}

function readEnv(): BootstrapEnv {
  const email = process.env['INITIAL_ADMIN_EMAIL'];
  const password = process.env['INITIAL_ADMIN_PASSWORD'];
  const name = process.env['INITIAL_ADMIN_NAME'];

  const missing: string[] = [];
  if (!email) missing.push('INITIAL_ADMIN_EMAIL');
  if (!password) missing.push('INITIAL_ADMIN_PASSWORD');
  if (!name) missing.push('INITIAL_ADMIN_NAME');

  if (missing.length > 0) {
    throw new Error(
      `必須環境変数が未設定です: ${missing.join(', ')}\n` +
        '.env ファイルに以下を設定してください:\n' +
        '  INITIAL_ADMIN_EMAIL=admin@example.com\n' +
        '  INITIAL_ADMIN_PASSWORD=<strong-password>\n' +
        '  INITIAL_ADMIN_NAME=管理者'
    );
  }

  if (password!.length < 8) {
    throw new Error('INITIAL_ADMIN_PASSWORD は8文字以上にしてください');
  }

  return { email: email!, password: password!, name: name! };
}

function ensureProductionAllowed(): void {
  if (
    process.env['NODE_ENV'] === 'production' &&
    process.env['ALLOW_BOOTSTRAP_IN_PRODUCTION'] !== 'true'
  ) {
    throw new Error(
      'NODE_ENV=production での実行はブロックされました。\n' +
        '意図的に実行する場合は ALLOW_BOOTSTRAP_IN_PRODUCTION=true を設定してください。'
    );
  }
}

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: process.env['DATABASE_URL'],
  });
  return new PrismaClient({ adapter });
}

async function main(): Promise<void> {
  ensureProductionAllowed();

  if (!isSupabaseAdminAvailable()) {
    throw new Error(
      'Supabase Admin が利用できません。\n' +
        'SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を .env に設定してください。'
    );
  }

  const env = readEnv();
  const prisma = createPrismaClient();

  try {
    const existingAdmin = await prisma.staff.findFirst({
      where: { role: 'admin', deleted_at: null },
      select: { id: true, email: true },
    });

    if (existingAdmin) {
      console.log(
        `✅ 既に admin が存在するため skip します (id=${existingAdmin.id}, email=${existingAdmin.email})`
      );
      return;
    }

    const existingStaffByEmail = await prisma.staff.findUnique({
      where: { email: env.email },
      select: { id: true, role: true },
    });

    if (existingStaffByEmail) {
      throw new Error(
        `メールアドレス ${env.email} の Staff が既に存在します (id=${existingStaffByEmail.id}, role=${existingStaffByEmail.role})。\n` +
          '別のメールアドレスを指定するか、既存レコードを確認してください。'
      );
    }

    console.log(`🔐 Supabase Auth にユーザーを作成中: ${env.email}`);
    const supabaseResult = await createSupabaseUserWithPassword(env.email, env.password, {
      name: env.name,
      role: 'admin',
    });

    if (!supabaseResult.success || !supabaseResult.user) {
      throw new Error(`Supabase ユーザー作成に失敗しました: ${supabaseResult.error}`);
    }

    const supabaseUid = supabaseResult.user.id;
    console.log(`✅ Supabase ユーザー作成完了 (uid=${supabaseUid})`);

    try {
      const staff = await prisma.staff.create({
        data: {
          supabase_uid: supabaseUid,
          email: env.email,
          name: env.name,
          role: 'admin',
          is_active: true,
        },
      });
      console.log(`✅ Staff テーブルに登録しました (id=${staff.id}, role=admin)`);
    } catch (dbError) {
      console.error('❌ Staff 登録に失敗したため Supabase ユーザーをロールバックします');
      const rollback = await deleteSupabaseUser(supabaseUid);
      if (!rollback.success) {
        console.error(
          `⚠️ Supabase ロールバックにも失敗しました。手動削除が必要です (uid=${supabaseUid}): ${rollback.error}`
        );
      }
      throw dbError;
    }

    console.log('\n🎉 初期管理者ブートストラップが完了しました');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Email:    ${env.email}`);
    console.log(`  Name:     ${env.name}`);
    console.log(`  Role:     admin`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('フロントエンドからこの認証情報でログインできます。');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`❌ ${message}`);
  process.exit(1);
});
