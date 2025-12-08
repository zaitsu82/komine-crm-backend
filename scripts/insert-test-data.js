const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function insertTestData() {
  try {
    console.log('🗂️ マスタデータを挿入中...');

    // 1. 墓地タイプマスタ
    const cemeteryTypes = [
      { code: '01', name: '公営墓地', description: '市区町村が運営する墓地', sort_order: 1 },
      { code: '02', name: '民営墓地', description: '民間企業が運営する墓地', sort_order: 2 },
      { code: '03', name: '寺院墓地', description: '寺院が管理する墓地', sort_order: 3 },
      { code: '04', name: '共同墓地', description: '地域共同で管理する墓地', sort_order: 4 },
      { code: '05', name: '納骨堂', description: '屋内型の納骨施設', sort_order: 5 },
    ];
    await prisma.cemeteryTypeMaster.createMany({ data: cemeteryTypes });

    // 4. 支払方法マスタ
    const paymentMethods = [
      { code: '01', name: '現金', description: '現金による支払い', sort_order: 1 },
      { code: '02', name: '銀行振込', description: '銀行振込による支払い', sort_order: 2 },
      { code: '03', name: '口座振替', description: '自動口座振替', sort_order: 3 },
      { code: '04', name: 'クレジットカード', description: 'クレジットカード決済', sort_order: 4 },
      { code: '05', name: '分割払い', description: '分割での支払い', sort_order: 5 },
    ];
    await prisma.paymentMethodMaster.createMany({ data: paymentMethods });

    // 5. 税区分マスタ
    const taxTypes = [
      { code: '01', name: '非課税', tax_rate: 0.00, description: '税金なし', sort_order: 1 },
      { code: '02', name: '消費税8%', tax_rate: 8.00, description: '軽減税率適用', sort_order: 2 },
      { code: '03', name: '消費税10%', tax_rate: 10.00, description: '標準税率', sort_order: 3 },
    ];
    await prisma.taxTypeMaster.createMany({ data: taxTypes });

    // 6. 計算区分マスタ
    const calcTypes = [
      { code: '01', name: '面積単価', description: '面積に単価を乗じて計算', sort_order: 1 },
      { code: '02', name: '一律料金', description: '面積に関わらず一律', sort_order: 2 },
      { code: '03', name: '階段料金', description: '面積に応じた段階的料金', sort_order: 3 },
      { code: '04', name: '基本料金＋従量', description: '基本料金と従量料金の合計', sort_order: 4 },
    ];
    await prisma.calcTypeMaster.createMany({ data: calcTypes });

    // 7. 請求区分マスタ
    const billingTypes = [
      { code: '01', name: '年次請求', description: '年に一度の請求', sort_order: 1 },
      { code: '02', name: '月次請求', description: '毎月の請求', sort_order: 2 },
      { code: '03', name: '一括請求', description: '一括での請求', sort_order: 3 },
      { code: '04', name: '臨時請求', description: '臨時・特別な請求', sort_order: 4 },
    ];
    await prisma.billingTypeMaster.createMany({ data: billingTypes });

    // 8. 口座科目マスタ
    const accountTypes = [
      { code: '01', name: '普通預金', description: '普通預金口座', sort_order: 1 },
      { code: '02', name: '当座預金', description: '当座預金口座', sort_order: 2 },
      { code: '03', name: '定期預金', description: '定期預金口座', sort_order: 3 },
      { code: '04', name: '貯蓄預金', description: '貯蓄預金口座', sort_order: 4 },
    ];
    await prisma.accountTypeMaster.createMany({ data: accountTypes });

    // 9. 宛先区分マスタ
    const recipientTypes = [
      { code: '01', name: '契約者住所', description: '契約者の住所に送付', sort_order: 1 },
      { code: '02', name: '勤務先住所', description: '契約者の勤務先住所に送付', sort_order: 2 },
      { code: '03', name: '家族住所', description: '家族の住所に送付', sort_order: 3 },
      { code: '04', name: 'その他住所', description: 'その他指定住所に送付', sort_order: 4 },
    ];
    await prisma.recipientTypeMaster.createMany({ data: recipientTypes });

    // 11. 工事種別マスタ
    const constructionTypes = [
      { code: '01', name: '新規建立', description: '新しい墓石の建立', sort_order: 1 },
      { code: '02', name: '改修工事', description: '既存墓石の改修', sort_order: 2 },
      { code: '03', name: '追加彫刻', description: '新たな彫刻の追加', sort_order: 3 },
      { code: '04', name: '清掃・メンテナンス', description: '定期的な清掃・メンテナンス', sort_order: 4 },
      { code: '05', name: '撤去工事', description: '墓石の撤去作業', sort_order: 5 },
    ];
    await prisma.constructionTypeMaster.createMany({ data: constructionTypes });

    console.log('✅ マスタデータの挿入が完了しました');

    console.log('🏛️ メインデータを挿入中...');

    // スタッフデータ（Supabase認証を使用）
    // 複数のスタッフを作成（権限レベル別）
    const staffData = [
      {
        name: '管理者',
        email: 'admin@example.com',
        supabase_uid: null, // Supabase登録後にUIDを設定
        role: 'admin',
        is_active: true,
      },
      {
        name: 'マネージャー',
        email: 'manager@example.com',
        supabase_uid: null,
        role: 'manager',
        is_active: true,
      },
      {
        name: 'オペレーター',
        email: 'operator@example.com',
        supabase_uid: null,
        role: 'operator',
        is_active: true,
      },
      {
        name: 'ビューワー',
        email: 'viewer@example.com',
        supabase_uid: null,
        role: 'viewer',
        is_active: true,
      },
    ];

    for (const staffMember of staffData) {
      await prisma.staff.create({ data: staffMember });
    }

    // 区画データ1（利用中）
    const plot1 = await prisma.plot.create({
      data: {
        plot_number: 'A-001',
        section: '東区',
        usage: 'in_use',
        size: '4.0㎡',
        price: '800,000円',
        contract_date: new Date('2024-03-01'),
        status: 'active',
        notes: '墓石建立済み、定期メンテナンス対象',
      },
    });

    // 区画データ2（空き）
    const plot2 = await prisma.plot.create({
      data: {
        plot_number: 'B-056',
        section: '西区',
        usage: 'available',
        size: '3.5㎡',
        price: '650,000円',
        status: 'active',
        notes: null,
      },
    });

    // 区画データ3（予約済み）
    const plot3 = await prisma.plot.create({
      data: {
        plot_number: 'C-102',
        section: '南区',
        usage: 'reserved',
        size: '5.0㎡',
        price: '1,000,000円',
        contract_date: new Date('2025-01-15'),
        status: 'active',
        notes: '2025年春より利用開始予定',
      },
    });

    // 申込者データ（区画3）
    await prisma.applicant.create({
      data: {
        plot_id: plot3.id,
        application_date: new Date('2024-12-01'),
        staff_name: '鈴木一郎',
        name: '佐藤健一',
        name_kana: 'さとうけんいち',
        postal_code: '456-7890',
        phone_number: '06-9876-5432',
        address: '大阪府大阪市中央区本町2-2-2',
      },
    });

    // 契約者データ（区画3）
    const contractor3 = await prisma.contractor.create({
      data: {
        plot_id: plot3.id,
        reservation_date: new Date('2024-12-10'),
        acceptance_number: 'C-2025-003',
        permit_date: new Date('2025-01-10'),
        start_date: new Date('2025-04-01'),
        name: '佐藤健一',
        name_kana: 'さとうけんいち',
        birth_date: new Date('1975-03-10'),
        gender: 'male',
        phone_number: '06-9876-5432',
        email: 'sato@example.com',
        address: '大阪府大阪市中央区本町2-2-2',
      },
    });

    // 工事情報（区画3 - 進行中）
    await prisma.constructionInfo.create({
      data: {
        plot_id: plot3.id,
        construction_type: '新規建立',
        start_date: new Date('2025-04-01'),
        completion_date: new Date('2025-06-30'),
        contractor: '関西石材株式会社',
        supervisor: '田中建設',
        progress: '許可申請中',
        work_item_1: '基礎工事',
        work_date_1: new Date('2025-04-15'),
        work_amount_1: 600000,
        work_status_1: '予定',
        work_item_2: '墓石設置',
        work_date_2: new Date('2025-06-15'),
        work_amount_2: 1500000,
        work_status_2: '予定',
        permit_number: '大阪-工-2025-0023',
        application_date: new Date('2025-02-01'),
        permit_date: null,
        permit_status: '申請中',
        payment_type_1: '着手金',
        payment_amount_1: 1050000,
        payment_date_1: null,
        payment_status_1: '未払い',
        payment_type_2: '完工金',
        payment_amount_2: 1050000,
        payment_scheduled_date_2: new Date('2025-06-30'),
        payment_status_2: '未払い',
        construction_notes: '黒御影石を使用予定。洋型墓石。',
      },
    });

    // 申込者データ（区画1）
    await prisma.applicant.create({
      data: {
        plot_id: plot1.id,
        application_date: new Date('2024-01-15'),
        staff_name: '田中太郎',
        name: '山田花子',
        name_kana: 'やまだはなこ',
        postal_code: '123-4567',
        phone_number: '03-1234-5678',
        address: '東京都新宿区西新宿1-1-1',
      },
    });

    // 契約者データ（区画1）
    const contractor1 = await prisma.contractor.create({
      data: {
        plot_id: plot1.id,
        reservation_date: new Date('2024-02-01'),
        acceptance_number: 'C-2024-001',
        permit_date: new Date('2024-02-15'),
        start_date: new Date('2024-03-01'),
        name: '山田太郎',
        name_kana: 'やまだたろう',
        birth_date: new Date('1965-05-20'),
        gender: 'male',
        phone_number: '03-1234-5678',
        fax_number: '03-1234-5679',
        email: 'yamada@example.com',
        address: '東京都新宿区西新宿1-1-1',
        registered_address: '東京都新宿区西新宿1-1-1',
      },
    });

    // 使用料情報（区画1）
    await prisma.usageFee.create({
      data: {
        plot_id: plot1.id,
        calculation_type: '面積単価',
        tax_type: '消費税10%',
        billing_type: '一括請求',
        billing_years: '永代',
        area: '4.0㎡',
        unit_price: '80,000円/㎡',
        usage_fee: '320,000円',
        payment_method: '口座振替',
      },
    });

    // 管理料情報（区画1）
    await prisma.managementFee.create({
      data: {
        plot_id: plot1.id,
        calculation_type: '一律料金',
        tax_type: '消費税10%',
        billing_type: '年次請求',
        billing_years: '毎年',
        area: '4.0㎡',
        billing_month: '4月',
        management_fee: '24,000円',
        unit_price: '24,000円',
        last_billing_month: '2025年4月',
        payment_method: '口座振替',
      },
    });

    // 墓石情報（区画1）
    await prisma.gravestoneInfo.create({
      data: {
        plot_id: plot1.id,
        gravestone_base: '御影石',
        enclosure_position: '全面囲い',
        gravestone_dealer: '石材工業株式会社',
        gravestone_type: '和型',
        surrounding_area: '植栽あり',
        establishment_deadline: new Date('2024-06-30'),
        establishment_date: new Date('2024-06-25'),
      },
    });

    // 工事情報（区画1）
    await prisma.constructionInfo.create({
      data: {
        plot_id: plot1.id,
        construction_type: '新規建立',
        start_date: new Date('2024-04-01'),
        completion_date: new Date('2024-06-25'),
        contractor: '石材工業株式会社',
        supervisor: '佐藤工務店',
        progress: '完工',
        work_item_1: '基礎工事',
        work_date_1: new Date('2024-04-15'),
        work_amount_1: 500000,
        work_status_1: '完了',
        work_item_2: '墓石設置',
        work_date_2: new Date('2024-06-20'),
        work_amount_2: 1200000,
        work_status_2: '完了',
        permit_number: '北九-工-2024-0156',
        application_date: new Date('2024-03-10'),
        permit_date: new Date('2024-03-25'),
        permit_status: '許可済み',
        payment_type_1: '着手金',
        payment_amount_1: 850000,
        payment_date_1: new Date('2024-04-01'),
        payment_status_1: '支払済み',
        payment_type_2: '完工金',
        payment_amount_2: 850000,
        payment_scheduled_date_2: new Date('2024-06-30'),
        payment_status_2: '支払済み',
        construction_notes: '御影石を使用した和型墓石。家紋彫刻あり。周辺に植栽を施工。',
      },
    });

    // 勤務先・連絡情報（契約者1）
    await prisma.workInfo.create({
      data: {
        contractor_id: contractor1.id,
        company_name: '株式会社山田商事',
        company_name_kana: 'かぶしきがいしゃやまだしょうじ',
        work_address: '東京都渋谷区渋谷1-1-1',
        work_postal_code: '150-0001',
        work_phone_number: '03-9876-5432',
        dm_setting: 'allow',
        address_type: 'home',
        notes: '平日9-18時連絡可',
      },
    });

    // 請求情報（契約者1）
    await prisma.billingInfo.create({
      data: {
        contractor_id: contractor1.id,
        billing_type: 'bank_transfer',
        bank_name: 'みずほ銀行',
        branch_name: '新宿支店',
        account_type: 'ordinary',
        account_number: '1234567',
        account_holder: '山田太郎',
      },
    });

    // 家族連絡先情報（区画1）
    await prisma.familyContact.create({
      data: {
        plot_id: plot1.id,
        name: '山田花子',
        birth_date: new Date('1970-08-15'),
        relationship: '配偶者',
        address: '東京都新宿区西新宿1-1-1',
        phone_number: '090-1234-5678',
        fax_number: null,
        email: 'hanako@example.com',
        registered_address: null,
        mailing_type: 'home',
        company_name: null,
        company_name_kana: null,
        company_address: null,
        company_phone: null,
        notes: '緊急連絡先',
      },
    });

    // 緊急連絡先（区画1）
    await prisma.emergencyContact.create({
      data: {
        plot_id: plot1.id,
        name: '山田次郎',
        relationship: '長男',
        phone_number: '090-9876-5432',
      },
    });

    // 埋葬者情報（区画1）
    await prisma.buriedPerson.create({
      data: {
        plot_id: plot1.id,
        name: '山田一郎',
        name_kana: 'やまだいちろう',
        relationship: '父',
        death_date: new Date('2023-11-15'),
        age: 83,
        gender: 'male',
        burial_date: new Date('2023-11-20'),
        memo: '2023年11月20日納骨',
      },
    });

    await prisma.buriedPerson.create({
      data: {
        plot_id: plot1.id,
        name: '山田美代子',
        name_kana: 'やまだみよこ',
        relationship: '母',
        death_date: new Date('2020-03-10'),
        age: 78,
        gender: 'female',
        burial_date: new Date('2020-03-15'),
        memo: '2020年3月15日納骨',
      },
    });

    // 履歴情報（区画1）
    await prisma.history.create({
      data: {
        entity_type: 'Plot',
        entity_id: plot1.id,
        plot_id: plot1.id,
        action_type: 'CREATE',
        changed_fields: ['plot_number', 'section', 'usage'],
        changed_by: '管理者',
        change_reason: '新規契約',
        ip_address: '192.168.1.100',
      },
    });

    console.log('✅ メインデータの挿入が完了しました');
    console.log('🎉 すべてのテストデータの挿入が完了しました！');

    // データ確認
    const plotCount = await prisma.plot.count();
    const contractorCount = await prisma.contractor.count();
    const staffCount = await prisma.staff.count();
    const masterTablesCount = await prisma.usageStatusMaster.count();

    console.log('\n📊 挿入されたデータの件数:');
    console.log(`- 区画: ${plotCount}件`);
    console.log(`- 契約者: ${contractorCount}件`);
    console.log(`- スタッフ: ${staffCount}件`);
    console.log(`- マスタテーブル例（利用状況）: ${masterTablesCount}件`);

    console.log('\n🔐 登録済みスタッフ:');
    console.log('- 管理者: admin@example.com (Supabase認証が必要)');
    console.log('- マネージャー: manager@example.com (Supabase認証が必要)');
    console.log('- オペレーター: operator@example.com (Supabase認証が必要)');
    console.log('- ビューワー: viewer@example.com (Supabase認証が必要)');

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

insertTestData();
