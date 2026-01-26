const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const prisma = new PrismaClient();

// Supabaseクライアントの初期化
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を .env ファイルに設定してください');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// テストユーザーデータ
const testUsers = [
  {
    email: 'admin@example.com',
    password: 'password123',
    name: '管理者',
    role: 'admin',
  },
  {
    email: 'manager@example.com',
    password: 'password123',
    name: 'マネージャー',
    role: 'manager',
  },
  {
    email: 'operator@example.com',
    password: 'password123',
    name: 'オペレーター',
    role: 'operator',
  },
  {
    email: 'viewer@example.com',
    password: 'password123',
    name: 'ビューワー',
    role: 'viewer',
  },
];

async function createTestUsers() {
  try {
    console.log('🔐 テストユーザーを作成中...\n');

    for (const user of testUsers) {
      console.log(`📧 ${user.email} を処理中...`);

      // 1. Supabaseにユーザーを作成
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true, // メール確認をスキップ
      });

      if (authError) {
        // 既に存在する場合は取得を試みる
        if (authError.message.includes('already been registered')) {
          console.log(`   ⚠️  Supabaseに既存のユーザーです。ユーザー情報を取得中...`);

          // 既存ユーザーを取得
          const { data: listData, error: listError } = await supabase.auth.admin.listUsers();

          if (listError) {
            console.error(`   ❌ ユーザー取得エラー: ${listError.message}`);
            continue;
          }

          const existingUser = listData.users.find(u => u.email === user.email);

          if (!existingUser) {
            console.error(`   ❌ ユーザーが見つかりません`);
            continue;
          }

          // Staffテーブルに登録（既存チェック）
          const existingStaff = await prisma.staff.findFirst({
            where: { email: user.email },
          });

          if (existingStaff) {
            // 既存のスタッフを更新
            await prisma.staff.update({
              where: { id: existingStaff.id },
              data: {
                supabase_uid: existingUser.id,
                name: user.name,
                role: user.role,
                is_active: true,
              },
            });
            console.log(`   ✅ Staffテーブルを更新しました (ID: ${existingStaff.id})`);
          } else {
            // 新規作成
            const newStaff = await prisma.staff.create({
              data: {
                supabase_uid: existingUser.id,
                email: user.email,
                name: user.name,
                role: user.role,
                is_active: true,
              },
            });
            console.log(`   ✅ Staffテーブルに登録しました (ID: ${newStaff.id})`);
          }
          continue;
        }

        console.error(`   ❌ Supabase認証エラー: ${authError.message}`);
        continue;
      }

      const supabaseUid = authData.user.id;
      console.log(`   ✅ Supabaseユーザー作成完了 (UID: ${supabaseUid})`);

      // 2. Staffテーブルに登録
      const existingStaff = await prisma.staff.findFirst({
        where: { email: user.email },
      });

      if (existingStaff) {
        // 既存のスタッフを更新
        await prisma.staff.update({
          where: { id: existingStaff.id },
          data: {
            supabase_uid: supabaseUid,
            name: user.name,
            role: user.role,
            is_active: true,
          },
        });
        console.log(`   ✅ Staffテーブルを更新しました (ID: ${existingStaff.id})`);
      } else {
        // 新規作成
        const newStaff = await prisma.staff.create({
          data: {
            supabase_uid: supabaseUid,
            email: user.email,
            name: user.name,
            role: user.role,
            is_active: true,
          },
        });
        console.log(`   ✅ Staffテーブルに登録しました (ID: ${newStaff.id})`);
      }

      console.log('');
    }

    console.log('🎉 テストユーザーの作成が完了しました！\n');
    console.log('📋 ログイン情報:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    testUsers.forEach(user => {
      console.log(`   ${user.role.padEnd(10)} | ${user.email.padEnd(25)} | ${user.password}`);
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // 登録確認
    const staffCount = await prisma.staff.count();
    console.log(`📊 Staffテーブルの件数: ${staffCount}件`);

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestUsers();
