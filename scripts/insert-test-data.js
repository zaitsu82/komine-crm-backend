const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function insertTestData() {
  try {
    console.log('🗂️ マスタデータを挿入中...');

    // 1. 利用状況マスタ
    const usageStatuses = [
      { code: '01', name: '空き', description: '利用可能な状態', sort_order: 1 },
      { code: '02', name: '予約済み', description: '予約が入っている状態', sort_order: 2 },
      { code: '03', name: '利用中', description: '契約者が利用中', sort_order: 3 },
      { code: '04', name: '使用停止', description: '何らかの理由で使用停止', sort_order: 4 },
      { code: '05', name: 'メンテナンス中', description: 'メンテナンス作業中', sort_order: 5 },
    ];
    await prisma.usageStatusMaster.createMany({ data: usageStatuses });

    // 2. 墓地タイプマスタ
    const cemeteryTypes = [
      { code: '01', name: '公営墓地', description: '市区町村が運営する墓地', sort_order: 1 },
      { code: '02', name: '民営墓地', description: '民間企業が運営する墓地', sort_order: 2 },
      { code: '03', name: '寺院墓地', description: '寺院が管理する墓地', sort_order: 3 },
      { code: '04', name: '共同墓地', description: '地域共同で管理する墓地', sort_order: 4 },
      { code: '05', name: '納骨堂', description: '屋内型の納骨施設', sort_order: 5 },
    ];
    await prisma.cemeteryTypeMaster.createMany({ data: cemeteryTypes });

    // 3. 宗派マスタ
    const denominations = [
      { code: '01', name: '浄土真宗', description: '浄土真宗各派', sort_order: 1 },
      { code: '02', name: '浄土宗', description: '法然を開祖とする宗派', sort_order: 2 },
      { code: '03', name: '真言宗', description: '空海を開祖とする宗派', sort_order: 3 },
      { code: '04', name: '曹洞宗', description: '道元を開祖とする禅宗', sort_order: 4 },
      { code: '05', name: '臨済宗', description: '栄西を開祖とする禅宗', sort_order: 5 },
      { code: '06', name: '日蓮宗', description: '日蓮を開祖とする宗派', sort_order: 6 },
      { code: '07', name: '天台宗', description: '最澄を開祖とする宗派', sort_order: 7 },
      { code: '08', name: 'その他仏教', description: 'その他の仏教宗派', sort_order: 8 },
      { code: '09', name: '神道', description: '日本の伝統的な宗教', sort_order: 9 },
      { code: '10', name: 'キリスト教', description: 'キリスト教各派', sort_order: 10 },
      { code: '11', name: '無宗教', description: '特定の宗教に属さない', sort_order: 11 },
    ];
    await prisma.denominationMaster.createMany({ data: denominations });

    // 4. 性別マスタ
    const genders = [
      { code: '01', name: '男性', description: '男性', sort_order: 1 },
      { code: '02', name: '女性', description: '女性', sort_order: 2 },
      { code: '03', name: 'その他', description: 'その他・不明', sort_order: 3 },
    ];
    await prisma.genderMaster.createMany({ data: genders });

    // 5. 支払方法マスタ
    const paymentMethods = [
      { code: '01', name: '現金', description: '現金による支払い', sort_order: 1 },
      { code: '02', name: '銀行振込', description: '銀行振込による支払い', sort_order: 2 },
      { code: '03', name: '口座振替', description: '自動口座振替', sort_order: 3 },
      { code: '04', name: 'クレジットカード', description: 'クレジットカード決済', sort_order: 4 },
      { code: '05', name: '分割払い', description: '分割での支払い', sort_order: 5 },
    ];
    await prisma.paymentMethodMaster.createMany({ data: paymentMethods });

    // 6. 税区分マスタ
    const taxTypes = [
      { code: '01', name: '非課税', tax_rate: 0.00, description: '税金なし', sort_order: 1 },
      { code: '02', name: '消費税8%', tax_rate: 8.00, description: '軽減税率適用', sort_order: 2 },
      { code: '03', name: '消費税10%', tax_rate: 10.00, description: '標準税率', sort_order: 3 },
    ];
    await prisma.taxTypeMaster.createMany({ data: taxTypes });

    // 7. 計算区分マスタ
    const calcTypes = [
      { code: '01', name: '面積単価', description: '面積に単価を乗じて計算', sort_order: 1 },
      { code: '02', name: '一律料金', description: '面積に関わらず一律', sort_order: 2 },
      { code: '03', name: '階段料金', description: '面積に応じた段階的料金', sort_order: 3 },
      { code: '04', name: '基本料金＋従量', description: '基本料金と従量料金の合計', sort_order: 4 },
    ];
    await prisma.calcTypeMaster.createMany({ data: calcTypes });

    // 8. 請求区分マスタ
    const billingTypes = [
      { code: '01', name: '年次請求', description: '年に一度の請求', sort_order: 1 },
      { code: '02', name: '月次請求', description: '毎月の請求', sort_order: 2 },
      { code: '03', name: '一括請求', description: '一括での請求', sort_order: 3 },
      { code: '04', name: '臨時請求', description: '臨時・特別な請求', sort_order: 4 },
    ];
    await prisma.billingTypeMaster.createMany({ data: billingTypes });

    // 9. 口座科目マスタ
    const accountTypes = [
      { code: '01', name: '普通預金', description: '普通預金口座', sort_order: 1 },
      { code: '02', name: '当座預金', description: '当座預金口座', sort_order: 2 },
      { code: '03', name: '定期預金', description: '定期預金口座', sort_order: 3 },
      { code: '04', name: '貯蓄預金', description: '貯蓄預金口座', sort_order: 4 },
    ];
    await prisma.accountTypeMaster.createMany({ data: accountTypes });

    // 10. 宛先区分マスタ
    const recipientTypes = [
      { code: '01', name: '契約者住所', description: '契約者の住所に送付', sort_order: 1 },
      { code: '02', name: '勤務先住所', description: '契約者の勤務先住所に送付', sort_order: 2 },
      { code: '03', name: '家族住所', description: '家族の住所に送付', sort_order: 3 },
      { code: '04', name: 'その他住所', description: 'その他指定住所に送付', sort_order: 4 },
    ];
    await prisma.recipientTypeMaster.createMany({ data: recipientTypes });

    // 11. 続柄マスタ
    const relations = [
      { code: '01', name: '配偶者', description: '夫または妻', sort_order: 1 },
      { code: '02', name: '子', description: '息子・娘', sort_order: 2 },
      { code: '03', name: '父', description: '父親', sort_order: 3 },
      { code: '04', name: '母', description: '母親', sort_order: 4 },
      { code: '05', name: '兄弟姉妹', description: '兄・弟・姉・妹', sort_order: 5 },
      { code: '06', name: '祖父母', description: '祖父・祖母', sort_order: 6 },
      { code: '07', name: '孫', description: '孫', sort_order: 7 },
      { code: '08', name: 'その他親族', description: 'その他の親族', sort_order: 8 },
      { code: '09', name: '友人・知人', description: '友人・知人', sort_order: 9 },
    ];
    await prisma.relationMaster.createMany({ data: relations });

    // 12. 工事種別マスタ
    const constructionTypes = [
      { code: '01', name: '新規建立', description: '新しい墓石の建立', sort_order: 1 },
      { code: '02', name: '改修工事', description: '既存墓石の改修', sort_order: 2 },
      { code: '03', name: '追加彫刻', description: '新たな彫刻の追加', sort_order: 3 },
      { code: '04', name: '清掃・メンテナンス', description: '定期的な清掃・メンテナンス', sort_order: 4 },
      { code: '05', name: '撤去工事', description: '墓石の撤去作業', sort_order: 5 },
    ];
    await prisma.constructionTypeMaster.createMany({ data: constructionTypes });

    // 13. 更新種別マスタ
    const updateTypes = [
      { code: '01', name: '新規登録', description: 'データの新規登録', sort_order: 1 },
      { code: '02', name: '更新', description: '既存データの更新', sort_order: 2 },
      { code: '03', name: '削除', description: 'データの削除', sort_order: 3 },
      { code: '04', name: '復旧', description: '削除データの復旧', sort_order: 4 },
      { code: '05', name: '状態変更', description: '利用状況等の状態変更', sort_order: 5 },
    ];
    await prisma.updateTypeMaster.createMany({ data: updateTypes });

    // 14. 都道府県マスタ（一部のみ）
    const prefectures = [
      { code: '01', name: '北海道', name_kana: 'ほっかいどう', sort_order: 1 },
      { code: '13', name: '東京都', name_kana: 'とうきょうと', sort_order: 13 },
      { code: '14', name: '神奈川県', name_kana: 'かながわけん', sort_order: 14 },
      { code: '27', name: '大阪府', name_kana: 'おおさかふ', sort_order: 27 },
      { code: '47', name: '沖縄県', name_kana: 'おきなわけん', sort_order: 47 },
    ];
    await prisma.prefectureMaster.createMany({ data: prefectures });

    console.log('✅ マスタデータの挿入が完了しました');

    console.log('🏛️ メインデータを挿入中...');

    // スタッフデータ
    const bcrypt = require('bcrypt');
    
    // 複数のスタッフを作成（権限レベル別）
    const staffData = [
      {
        name: '管理者',
        email: 'admin@example.com',
        password: await bcrypt.hash('admin123', 10),
        role: 'admin',
        is_active: true,
      },
      {
        name: 'マネージャー',
        email: 'manager@example.com',
        password: await bcrypt.hash('manager123', 10),
        role: 'manager',
        is_active: true,
      },
      {
        name: 'オペレーター',
        email: 'operator@example.com',
        password: await bcrypt.hash('operator123', 10),
        role: 'operator',
        is_active: true,
      },
      {
        name: 'ビューワー',
        email: 'viewer@example.com',
        password: await bcrypt.hash('viewer123', 10),
        role: 'viewer',
        is_active: true,
      },
    ];

    for (const staffMember of staffData) {
      await prisma.staff.create({ data: staffMember });
    }

    // 墓石データ
    const gravestone1 = await prisma.gravestone.create({
      data: {
        gravestone_code: 'A-001',
        usage_status: '03', // 利用中
        price: 800000.00,
        orientation: '南向き',
        location: '1区画1号',
        cemetery_type: '01', // 公営墓地
        denomination: '01', // 浄土真宗
        inscription: '○○家之墓',
        construction_deadline: new Date('2025-12-31'),
        construction_date: new Date('2024-06-15'),
        epitaph: '先祖代々の墓',
        remarks: '特になし',
      },
    });

    const gravestone2 = await prisma.gravestone.create({
      data: {
        gravestone_code: 'B-056',
        usage_status: '01', // 空き
        price: 650000.00,
        orientation: '東向き',
        location: '2区画56号',
        cemetery_type: '02', // 民営墓地
        denomination: '03', // 真言宗
        remarks: '空き区画',
      },
    });

    // 申込者データ
    await prisma.applicant.create({
      data: {
        gravestone_id: gravestone1.id,
        application_date: new Date('2024-01-15'),
        staff_name: '田中太郎',
        name: '山田花子',
        kana: 'ヤマダハナコ',
        postal_code: '123-4567',
        address: '東京都新宿区西新宿1-1-1',
        phone: '03-1234-5678',
        remarks: '初回申込',
        effective_start_date: new Date('2024-01-15'),
      },
    });

    // 契約者データ
    const contractor1 = await prisma.contractor.create({
      data: {
        gravestone_id: gravestone1.id,
        reservation_date: new Date('2024-02-01'),
        consent_form_number: 'C-2024-001',
        permission_date: new Date('2024-02-15'),
        start_date: new Date('2024-03-01'),
        name: '山田太郎',
        kana: 'ヤマダタロウ',
        birth_date: new Date('1965-05-20'),
        gender: '01', // 男性
        postal_code: '123-4567',
        address: '東京都新宿区西新宿1-1-1',
        phone: '03-1234-5678',
        fax: '03-1234-5679',
        email: 'yamada@example.com',
        domicile_address: '東京都新宿区西新宿1-1-1',
        workplace_name: '株式会社山田商事',
        workplace_kana: 'カブシキガイシャヤマダショウジ',
        workplace_address: '東京都渋谷区渋谷1-1-1',
        workplace_phone: '03-9876-5432',
        dm_setting: '送付希望',
        recipient_type: '01', // 契約者住所
        remarks: '長男、跡継ぎ',
        effective_start_date: new Date('2024-03-01'),
      },
    });

    // 使用料情報
    await prisma.usageFee.create({
      data: {
        gravestone_id: gravestone1.id,
        calc_type: '01', // 面積単価
        area: 4.00,
        fee: 320000.00,
        tax_type: '03', // 消費税10%
        billing_years: 1,
        unit_price: 80000.00,
        payment_method: '03', // 口座振替
        remarks: '年間使用料',
        effective_start_date: new Date('2024-03-01'),
      },
    });

    // 管理料情報
    await prisma.managementFee.create({
      data: {
        gravestone_id: gravestone1.id,
        calc_type: '02', // 一律料金
        billing_type: '01', // 年次請求
        area: 4.00,
        fee: 24000.00,
        last_billing_date: new Date('2024-04-01'),
        tax_type: '03', // 消費税10%
        billing_years: 1,
        billing_month: 4,
        unit_price: 24000.00,
        payment_method: '03', // 口座振替
        remarks: '年間管理料',
        effective_start_date: new Date('2024-03-01'),
      },
    });

    // 請求情報
    await prisma.billingInfo.create({
      data: {
        gravestone_id: gravestone1.id,
        contractor_id: contractor1.id,
        billing_type: '01', // 年次請求
        bank_name: 'みずほ銀行',
        branch_name: '新宿支店',
        account_type: '01', // 普通預金
        account_number: '1234567',
        account_holder: '山田太郎',
        remarks: '自動振替設定済み',
        effective_start_date: new Date('2024-03-01'),
      },
    });

    // 家族連絡先情報
    await prisma.familyContact.create({
      data: {
        gravestone_id: gravestone1.id,
        contractor_id: contractor1.id,
        name: '山田花子',
        birth_date: new Date('1970-08-15'),
        relation: '01', // 配偶者
        phone: '090-1234-5678',
        email: 'hanako@example.com',
        address: '東京都新宿区西新宿1-1-1',
        recipient_type: '01', // 契約者住所
        remarks: '緊急連絡先',
        effective_start_date: new Date('2024-03-01'),
      },
    });

    // 埋葬者情報
    await prisma.burial.create({
      data: {
        gravestone_id: gravestone1.id,
        contractor_id: contractor1.id,
        name: '山田一郎',
        kana: 'ヤマダイチロウ',
        birth_date: new Date('1940-12-01'),
        gender: '01', // 男性
        posthumous_name: '○○院○○居士',
        death_date: new Date('2023-11-15'),
        age_at_death: 83,
        burial_date: new Date('2023-11-20'),
        notification_date: new Date('2023-11-16'),
        denomination: '01', // 浄土真宗
        remarks: '父',
        effective_start_date: new Date('2023-11-20'),
      },
    });

    // 工事情報
    await prisma.construction.create({
      data: {
        gravestone_id: gravestone1.id,
        contractor_name: '石材工業株式会社',
        start_date: new Date('2024-06-01'),
        planned_end_date: new Date('2024-06-30'),
        end_date: new Date('2024-06-25'),
        description: '墓石新規建立工事',
        cost: 1200000.00,
        payment_amount: 1200000.00,
        construction_type: '01', // 新規建立
        remarks: '工事完了',
      },
    });

    // 履歴情報
    await prisma.history.create({
      data: {
        gravestone_id: gravestone1.id,
        contractor_id: contractor1.id,
        update_type: '01', // 新規登録
        update_reason: '新規契約',
        updated_by: '管理者',
        updated_at: new Date('2024-03-01'),
      },
    });

    console.log('✅ メインデータの挿入が完了しました');
    console.log('🎉 すべてのテストデータの挿入が完了しました！');

    // データ確認
    const gravestoneCount = await prisma.gravestone.count();
    const contractorCount = await prisma.contractor.count();
    const staffCount = await prisma.staff.count();
    const masterTablesCount = await prisma.usageStatusMaster.count();

    console.log('\n📊 挿入されたデータの件数:');
    console.log(`- 墓石: ${gravestoneCount}件`);
    console.log(`- 契約者: ${contractorCount}件`);
    console.log(`- スタッフ: ${staffCount}件`);
    console.log(`- マスタテーブル例（利用状況）: ${masterTablesCount}件`);
    
    console.log('\n🔐 テストアカウント:');
    console.log('- 管理者: admin@example.com / admin123');
    console.log('- マネージャー: manager@example.com / manager123');
    console.log('- オペレーター: operator@example.com / operator123');
    console.log('- ビューワー: viewer@example.com / viewer123');

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

insertTestData();