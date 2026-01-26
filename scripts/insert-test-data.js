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
    await prisma.cemeteryTypeMaster.createMany({ data: cemeteryTypes, skipDuplicates: true });

    // 4. 支払方法マスタ
    const paymentMethods = [
      { code: '01', name: '現金', description: '現金による支払い', sort_order: 1 },
      { code: '02', name: '銀行振込', description: '銀行振込による支払い', sort_order: 2 },
      { code: '03', name: '口座振替', description: '自動口座振替', sort_order: 3 },
      { code: '04', name: 'クレジットカード', description: 'クレジットカード決済', sort_order: 4 },
      { code: '05', name: '分割払い', description: '分割での支払い', sort_order: 5 },
    ];
    await prisma.paymentMethodMaster.createMany({ data: paymentMethods, skipDuplicates: true });

    // 5. 税区分マスタ
    const taxTypes = [
      { code: '01', name: '非課税', tax_rate: 0.00, description: '税金なし', sort_order: 1 },
      { code: '02', name: '消費税8%', tax_rate: 8.00, description: '軽減税率適用', sort_order: 2 },
      { code: '03', name: '消費税10%', tax_rate: 10.00, description: '標準税率', sort_order: 3 },
    ];
    await prisma.taxTypeMaster.createMany({ data: taxTypes, skipDuplicates: true });

    // 6. 計算区分マスタ
    const calcTypes = [
      { code: '01', name: '面積単価', description: '面積に単価を乗じて計算', sort_order: 1 },
      { code: '02', name: '一律料金', description: '面積に関わらず一律', sort_order: 2 },
      { code: '03', name: '階段料金', description: '面積に応じた段階的料金', sort_order: 3 },
      { code: '04', name: '基本料金＋従量', description: '基本料金と従量料金の合計', sort_order: 4 },
    ];
    await prisma.calcTypeMaster.createMany({ data: calcTypes, skipDuplicates: true });

    // 7. 請求区分マスタ
    const billingTypes = [
      { code: '01', name: '年次請求', description: '年に一度の請求', sort_order: 1 },
      { code: '02', name: '月次請求', description: '毎月の請求', sort_order: 2 },
      { code: '03', name: '一括請求', description: '一括での請求', sort_order: 3 },
      { code: '04', name: '臨時請求', description: '臨時・特別な請求', sort_order: 4 },
    ];
    await prisma.billingTypeMaster.createMany({ data: billingTypes, skipDuplicates: true });

    // 8. 口座科目マスタ
    const accountTypes = [
      { code: '01', name: '普通預金', description: '普通預金口座', sort_order: 1 },
      { code: '02', name: '当座預金', description: '当座預金口座', sort_order: 2 },
      { code: '03', name: '定期預金', description: '定期預金口座', sort_order: 3 },
      { code: '04', name: '貯蓄預金', description: '貯蓄預金口座', sort_order: 4 },
    ];
    await prisma.accountTypeMaster.createMany({ data: accountTypes, skipDuplicates: true });

    // 9. 宛先区分マスタ
    const recipientTypes = [
      { code: '01', name: '契約者住所', description: '契約者の住所に送付', sort_order: 1 },
      { code: '02', name: '勤務先住所', description: '契約者の勤務先住所に送付', sort_order: 2 },
      { code: '03', name: '家族住所', description: '家族の住所に送付', sort_order: 3 },
      { code: '04', name: 'その他住所', description: 'その他指定住所に送付', sort_order: 4 },
    ];
    await prisma.recipientTypeMaster.createMany({ data: recipientTypes, skipDuplicates: true });

    // 11. 工事種別マスタ
    const constructionTypes = [
      { code: '01', name: '新規建立', description: '新しい墓石の建立', sort_order: 1 },
      { code: '02', name: '改修工事', description: '既存墓石の改修', sort_order: 2 },
      { code: '03', name: '追加彫刻', description: '新たな彫刻の追加', sort_order: 3 },
      { code: '04', name: '清掃・メンテナンス', description: '定期的な清掃・メンテナンス', sort_order: 4 },
      { code: '05', name: '撤去工事', description: '墓石の撤去作業', sort_order: 5 },
    ];
    await prisma.constructionTypeMaster.createMany({ data: constructionTypes, skipDuplicates: true });

    console.log('✅ マスタデータの挿入が完了しました');

    console.log('🏛️ メインデータを挿入中...');

    // =========================================================================
    // 物理区画データ
    // =========================================================================

    // 物理区画1（利用中）
    const physicalPlot1 = await prisma.physicalPlot.create({
      data: {
        plot_number: 'A-001',
        area_name: '東区1期',
        area_sqm: 3.6,
        status: 'sold_out',
        notes: '墓石建立済み、定期メンテナンス対象',
      },
    });

    // 物理区画2（空き）
    const physicalPlot2 = await prisma.physicalPlot.create({
      data: {
        plot_number: 'B-056',
        area_name: '西区2期',
        area_sqm: 3.6,
        status: 'available',
        notes: null,
      },
    });

    // 物理区画3（予約済み）
    const physicalPlot3 = await prisma.physicalPlot.create({
      data: {
        plot_number: 'C-102',
        area_name: '南区3期',
        area_sqm: 5.0,
        status: 'sold_out',
        notes: '2025年春より利用開始予定',
      },
    });

    // 物理区画4（一部販売済み - 分割販売テスト用）
    const physicalPlot4 = await prisma.physicalPlot.create({
      data: {
        plot_number: 'D-200',
        area_name: '北区4期',
        area_sqm: 7.2,
        status: 'partially_sold',
        notes: '分割販売中の区画',
      },
    });

    // =========================================================================
    // 顧客データ
    // =========================================================================

    // 顧客1（山田太郎 - 契約者）
    const customer1 = await prisma.customer.create({
      data: {
        name: '山田太郎',
        name_kana: 'やまだたろう',
        birth_date: new Date('1965-05-20'),
        gender: 'male',
        postal_code: '1234567',
        address: '東京都新宿区西新宿1-1-1',
        registered_address: '東京都新宿区西新宿1-1-1',
        phone_number: '03123456',
        fax_number: '03123457',
        email: 'yamada@example.com',
        notes: '主要契約者',
      },
    });

    // 顧客2（山田花子 - 申込者）
    const customer2 = await prisma.customer.create({
      data: {
        name: '山田花子',
        name_kana: 'やまだはなこ',
        birth_date: new Date('1970-08-15'),
        gender: 'female',
        postal_code: '1234567',
        address: '東京都新宿区西新宿1-1-1',
        phone_number: '09012345678',
        email: 'hanako@example.com',
        notes: '配偶者',
      },
    });

    // 顧客3（佐藤健一 - 契約者）
    const customer3 = await prisma.customer.create({
      data: {
        name: '佐藤健一',
        name_kana: 'さとうけんいち',
        birth_date: new Date('1975-03-10'),
        gender: 'male',
        postal_code: '4567890',
        address: '大阪府大阪市中央区本町2-2-2',
        phone_number: '06987654',
        email: 'sato@example.com',
      },
    });

    // 顧客4（鈴木一郎 - 分割販売用契約者）
    const customer4 = await prisma.customer.create({
      data: {
        name: '鈴木一郎',
        name_kana: 'すずきいちろう',
        birth_date: new Date('1980-12-25'),
        gender: 'male',
        postal_code: '1500001',
        address: '東京都渋谷区神宮前1-2-3',
        phone_number: '03111222',
        email: 'suzuki@example.com',
      },
    });

    // 顧客5（田中美咲 - 分割販売用契約者）
    const customer5 = await prisma.customer.create({
      data: {
        name: '田中美咲',
        name_kana: 'たなかみさき',
        birth_date: new Date('1985-07-07'),
        gender: 'female',
        postal_code: '1600022',
        address: '東京都新宿区新宿3-4-5',
        phone_number: '03333444',
        email: 'tanaka@example.com',
      },
    });

    // =========================================================================
    // 契約区画データ
    // =========================================================================

    // 契約区画1（物理区画1に紐づく - 利用中）
    const contractPlot1 = await prisma.contractPlot.create({
      data: {
        physical_plot_id: physicalPlot1.id,
        contract_area_sqm: 3.6,
        location_description: null,
        contract_date: new Date('2024-03-01'),
        price: 800000,
        payment_status: 'paid',
        reservation_date: new Date('2024-02-01'),
        acceptance_number: 'C-2024-001',
        permit_date: new Date('2024-02-15'),
        permit_number: 'P-2024-001',
        start_date: new Date('2024-03-01'),
        notes: '永代使用権契約完了',
      },
    });

    // 契約区画2（物理区画3に紐づく - 予約済み）
    const contractPlot2 = await prisma.contractPlot.create({
      data: {
        physical_plot_id: physicalPlot3.id,
        contract_area_sqm: 5.0,
        location_description: null,
        contract_date: new Date('2025-01-15'),
        price: 1000000,
        payment_status: 'partial_paid',
        reservation_date: new Date('2024-12-10'),
        acceptance_number: 'C-2025-003',
        permit_date: new Date('2025-01-10'),
        start_date: new Date('2025-04-01'),
        notes: '2025年春より利用開始予定',
      },
    });

    // 契約区画3（物理区画4に紐づく - 分割販売 左半分）
    const contractPlot3 = await prisma.contractPlot.create({
      data: {
        physical_plot_id: physicalPlot4.id,
        contract_area_sqm: 3.6,
        location_description: '左半分',
        contract_date: new Date('2024-06-01'),
        price: 720000,
        payment_status: 'paid',
        reservation_date: new Date('2024-05-15'),
        acceptance_number: 'C-2024-010',
        permit_date: new Date('2024-05-25'),
        permit_number: 'P-2024-010',
        start_date: new Date('2024-06-01'),
        notes: '分割販売（左半分）',
      },
    });

    // 契約区画4（物理区画4に紐づく - 分割販売 右半分）
    const contractPlot4 = await prisma.contractPlot.create({
      data: {
        physical_plot_id: physicalPlot4.id,
        contract_area_sqm: 3.6,
        location_description: '右半分',
        contract_date: new Date('2024-09-01'),
        price: 720000,
        payment_status: 'unpaid',
        reservation_date: new Date('2024-08-20'),
        acceptance_number: 'C-2024-015',
        start_date: null,
        notes: '分割販売（右半分）- 支払い待ち',
      },
    });

    // =========================================================================
    // 販売契約役割（顧客と契約区画の紐づけ）
    // =========================================================================

    // 契約区画1: 山田太郎(契約者)、山田花子(申込者)
    await prisma.saleContractRole.create({
      data: {
        contract_plot_id: contractPlot1.id,
        customer_id: customer1.id,
        role: 'contractor',
        role_start_date: new Date('2024-03-01'),
        notes: '主契約者',
      },
    });
    await prisma.saleContractRole.create({
      data: {
        contract_plot_id: contractPlot1.id,
        customer_id: customer2.id,
        role: 'applicant',
        role_start_date: new Date('2024-01-15'),
        notes: '申込者（配偶者）',
      },
    });

    // 契約区画2: 佐藤健一(契約者・申込者)
    await prisma.saleContractRole.create({
      data: {
        contract_plot_id: contractPlot2.id,
        customer_id: customer3.id,
        role: 'contractor',
        role_start_date: new Date('2025-01-15'),
      },
    });
    await prisma.saleContractRole.create({
      data: {
        contract_plot_id: contractPlot2.id,
        customer_id: customer3.id,
        role: 'applicant',
        role_start_date: new Date('2024-12-01'),
      },
    });

    // 契約区画3: 鈴木一郎(契約者)
    await prisma.saleContractRole.create({
      data: {
        contract_plot_id: contractPlot3.id,
        customer_id: customer4.id,
        role: 'contractor',
        role_start_date: new Date('2024-06-01'),
      },
    });

    // 契約区画4: 田中美咲(契約者)
    await prisma.saleContractRole.create({
      data: {
        contract_plot_id: contractPlot4.id,
        customer_id: customer5.id,
        role: 'contractor',
        role_start_date: new Date('2024-09-01'),
      },
    });

    // =========================================================================
    // 勤務先・連絡情報（顧客に紐づく）
    // =========================================================================

    await prisma.workInfo.create({
      data: {
        customer_id: customer1.id,
        company_name: '株式会社山田商事',
        company_name_kana: 'かぶしきがいしゃやまだしょうじ',
        work_address: '東京都渋谷区渋谷1-1-1',
        work_postal_code: '1500001',
        work_phone_number: '03987654',
        dm_setting: 'allow',
        address_type: 'home',
        notes: '平日9-18時連絡可',
      },
    });

    // =========================================================================
    // 請求情報（顧客に紐づく）
    // =========================================================================

    await prisma.billingInfo.create({
      data: {
        customer_id: customer1.id,
        billing_type: 'bank_transfer',
        bank_name: 'みずほ銀行',
        branch_name: '新宿支店',
        account_type: 'ordinary',
        account_number: '1234567',
        account_holder: '山田太郎',
      },
    });

    // =========================================================================
    // 使用料情報（契約区画に紐づく）
    // =========================================================================

    await prisma.usageFee.create({
      data: {
        contract_plot_id: contractPlot1.id,
        calculation_type: '面積単価',
        tax_type: '消費税10%',
        billing_type: '一括請求',
        billing_years: '永代',
        area: '3.6㎡',
        unit_price: '80,000円/㎡',
        usage_fee: '288,000円',
        payment_method: '口座振替',
      },
    });

    // =========================================================================
    // 管理料情報（契約区画に紐づく）
    // =========================================================================

    await prisma.managementFee.create({
      data: {
        contract_plot_id: contractPlot1.id,
        calculation_type: '一律料金',
        tax_type: '消費税10%',
        billing_type: '年次請求',
        billing_years: '毎年',
        area: '3.6㎡',
        billing_month: '4月',
        management_fee: '24,000円',
        unit_price: '24,000円',
        last_billing_month: '2025年4月',
        payment_method: '口座振替',
      },
    });

    // =========================================================================
    // 墓石情報（契約区画に紐づく）
    // =========================================================================

    await prisma.gravestoneInfo.create({
      data: {
        contract_plot_id: contractPlot1.id,
        gravestone_base: '御影石',
        enclosure_position: '全面囲い',
        gravestone_dealer: '石材工業株式会社',
        gravestone_type: '和型',
        surrounding_area: '植栽あり',
        establishment_deadline: new Date('2024-06-30'),
        establishment_date: new Date('2024-06-25'),
      },
    });

    // =========================================================================
    // 工事情報（契約区画に紐づく）
    // =========================================================================

    // 契約区画1の工事（完了）
    await prisma.constructionInfo.create({
      data: {
        contract_plot_id: contractPlot1.id,
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
        payment_date_2: new Date('2024-06-30'),
        payment_status_2: '支払済み',
        notes: '御影石を使用した和型墓石。家紋彫刻あり。周辺に植栽を施工。',
      },
    });

    // 契約区画2の工事（進行中）
    await prisma.constructionInfo.create({
      data: {
        contract_plot_id: contractPlot2.id,
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
        permit_status: '申請中',
        payment_type_1: '着手金',
        payment_amount_1: 1050000,
        payment_status_1: '未払い',
        payment_type_2: '完工金',
        payment_amount_2: 1050000,
        payment_status_2: '未払い',
        notes: '黒御影石を使用予定。洋型墓石。',
      },
    });

    // =========================================================================
    // 家族連絡先（契約区画に紐づく）
    // =========================================================================

    await prisma.familyContact.create({
      data: {
        contract_plot_id: contractPlot1.id,
        customer_id: customer2.id,
        emergency_contact_flag: true,
        name: '山田花子',
        birth_date: new Date('1970-08-15'),
        relationship: '配偶者',
        postal_code: '1234567',
        address: '東京都新宿区西新宿1-1-1',
        phone_number: '09012345678',
        email: 'hanako@example.com',
        mailing_type: 'home',
        notes: '緊急連絡先',
      },
    });

    await prisma.familyContact.create({
      data: {
        contract_plot_id: contractPlot1.id,
        emergency_contact_flag: true,
        name: '山田次郎',
        relationship: '長男',
        address: '東京都中野区中野1-1-1',
        phone_number: '09098765432',
        notes: '第二緊急連絡先',
      },
    });

    // =========================================================================
    // 埋葬者情報（契約区画に紐づく）
    // =========================================================================

    await prisma.buriedPerson.create({
      data: {
        contract_plot_id: contractPlot1.id,
        name: '山田一郎',
        name_kana: 'やまだいちろう',
        relationship: '父',
        death_date: new Date('2023-11-15'),
        age: 83,
        gender: 'male',
        burial_date: new Date('2023-11-20'),
        notes: '2023年11月20日納骨',
      },
    });

    await prisma.buriedPerson.create({
      data: {
        contract_plot_id: contractPlot1.id,
        name: '山田美代子',
        name_kana: 'やまだみよこ',
        relationship: '母',
        death_date: new Date('2020-03-10'),
        age: 78,
        gender: 'female',
        burial_date: new Date('2020-03-15'),
        notes: '2020年3月15日納骨',
      },
    });

    // =========================================================================
    // 合葬情報（契約区画に紐づく）
    // =========================================================================

    await prisma.collectiveBurial.create({
      data: {
        contract_plot_id: contractPlot1.id,
        burial_capacity: 6,
        current_burial_count: 2,
        validity_period_years: 33,
        billing_status: 'pending',
        notes: '永代供養墓（33年契約）',
      },
    });

    // =========================================================================
    // 履歴情報
    // =========================================================================

    // entity_idはVarChar(32)のため、UUIDからハイフンを除去して32文字に収める
    await prisma.history.create({
      data: {
        entity_type: 'ContractPlot',
        entity_id: contractPlot1.id.replace(/-/g, ''),
        physical_plot_id: physicalPlot1.id,
        contract_plot_id: contractPlot1.id,
        action_type: 'CREATE',
        changed_fields: ['contract_date', 'price', 'payment_status'],
        changed_by: '管理者',
        change_reason: '新規契約',
        ip_address: '192.168.1.100',
      },
    });

    console.log('✅ メインデータの挿入が完了しました');
    console.log('🎉 すべてのテストデータの挿入が完了しました！');

    // データ確認
    const physicalPlotCount = await prisma.physicalPlot.count();
    const contractPlotCount = await prisma.contractPlot.count();
    const customerCount = await prisma.customer.count();
    const saleContractRoleCount = await prisma.saleContractRole.count();

    console.log('\n📊 挿入されたデータの件数:');
    console.log(`- 物理区画: ${physicalPlotCount}件`);
    console.log(`- 契約区画: ${contractPlotCount}件`);
    console.log(`- 顧客: ${customerCount}件`);
    console.log(`- 販売契約役割: ${saleContractRoleCount}件`);

    console.log('\n📋 テストデータの概要:');
    console.log('- 物理区画 A-001: 利用中（契約区画1件、埋葬者2名）');
    console.log('- 物理区画 B-056: 空き区画');
    console.log('- 物理区画 C-102: 予約済み（2025年春開始予定）');
    console.log('- 物理区画 D-200: 分割販売中（契約区画2件）');

    console.log('\n🔐 注意: スタッフデータはSupabase認証で管理されています。');
    console.log('   別途Supabaseでユーザーを作成し、staffテーブルに登録してください。');

  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  } finally {
    await prisma.$disconnect();
  }
}

insertTestData();
