import {
  plotSearchQuerySchema,
  plotIdParamsSchema,
  createPlotSchema,
  updatePlotSchema,
} from '../../src/validations/plotValidation';

describe('Plot Validation', () => {
  describe('plotSearchQuerySchema', () => {
    it('有効な検索クエリでバリデーションが成功すること', () => {
      const validData = {
        page: '1',
        limit: '20',
        search: 'A-001',
        usageStatus: 'in_use',
        cemeteryType: 'general',
      };

      const result = plotSearchQuerySchema.parse(validData);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.search).toBe('A-001');
    });

    it('パラメータが未指定の場合デフォルト値が設定されること', () => {
      const result = plotSearchQuerySchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('オプションパラメータが省略可能であること', () => {
      const validData = {
        page: '2',
        limit: '50',
      };

      const result = plotSearchQuerySchema.parse(validData);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(50);
    });
  });

  describe('plotIdParamsSchema', () => {
    it('有効なUUID形式のIDでバリデーションが成功すること', () => {
      const validData = {
        id: '123e4567-e89b-12d3-a456-426614174000',
      };

      expect(() => plotIdParamsSchema.parse(validData)).not.toThrow();
    });

    it('無効なUUID形式でエラーが発生すること', () => {
      const invalidData = {
        id: 'invalid-uuid',
      };

      expect(() => plotIdParamsSchema.parse(invalidData)).toThrow();
    });

    it('IDが欠けている場合エラーが発生すること', () => {
      expect(() => plotIdParamsSchema.parse({})).toThrow();
    });
  });

  describe('createPlotSchema', () => {
    const validPlotData = {
      gravestoneCode: 'A-001',
      usageStatus: 'in_use',
      cemeteryType: 'general',
      denomination: 'buddhism',
      contractDate: '2024-01-01',
      area: 3.5,
      notes: 'テスト備考',
    };

    it('有効な区画データでバリデーションが成功すること', () => {
      expect(() => createPlotSchema.parse(validPlotData)).not.toThrow();
    });

    it('墓石番号が必須であること', () => {
      const { gravestoneCode, ...dataWithoutCode } = validPlotData;
      expect(() => createPlotSchema.parse(dataWithoutCode)).toThrow();
    });

    it('墓石番号が空文字でエラーが発生すること', () => {
      const invalidData = { ...validPlotData, gravestoneCode: '' };
      expect(() => createPlotSchema.parse(invalidData)).toThrow();
    });

    it('墓石番号が50文字を超える場合エラーが発生すること', () => {
      const invalidData = { ...validPlotData, gravestoneCode: 'A'.repeat(51) };
      expect(() => createPlotSchema.parse(invalidData)).toThrow();
    });

    it('墓石番号が大文字英数字とハイフンのみ使用できること', () => {
      expect(() => createPlotSchema.parse({ ...validPlotData, gravestoneCode: 'A-001' })).not.toThrow();
      expect(() => createPlotSchema.parse({ ...validPlotData, gravestoneCode: 'ABC123' })).not.toThrow();
      expect(() => createPlotSchema.parse({ ...validPlotData, gravestoneCode: 'a-001' })).toThrow();
      expect(() => createPlotSchema.parse({ ...validPlotData, gravestoneCode: 'A_001' })).toThrow();
    });

    it('申込者情報が有効であること', () => {
      const dataWithApplicant = {
        ...validPlotData,
        applicant: {
          name: '山田太郎',
          nameKana: 'ヤマダ タロウ',
          birthDate: '1980-01-01',
          gender: 'male',
          phoneNumber: '03-1234-5678',
          faxNumber: '03-1234-5679',
          email: 'test@example.com',
          address: '東京都渋谷区',
          registeredAddress: '東京都渋谷区',
        },
      };

      expect(() => createPlotSchema.parse(dataWithApplicant)).not.toThrow();
    });

    it('申込者名が必須であること', () => {
      const dataWithInvalidApplicant = {
        ...validPlotData,
        applicant: {
          nameKana: 'ヤマダ タロウ',
        },
      };

      expect(() => createPlotSchema.parse(dataWithInvalidApplicant)).toThrow();
    });

    it('申込者名カナがカタカナであること', () => {
      const dataWithInvalidKana = {
        ...validPlotData,
        applicant: {
          name: '山田太郎',
          nameKana: 'やまだ たろう', // ひらがなはNG
        },
      };

      expect(() => createPlotSchema.parse(dataWithInvalidKana)).toThrow();
    });

    it('契約者情報が有効であること', () => {
      const dataWithContractor = {
        ...validPlotData,
        contractor: {
          name: '鈴木花子',
          nameKana: 'スズキ ハナコ',
          birthDate: '1985-05-15',
          gender: 'female',
          phoneNumber: '090-1234-5678',
          faxNumber: '',
          email: 'contractor@example.com',
          address: '大阪府大阪市',
          registeredAddress: '大阪府大阪市',
        },
      };

      expect(() => createPlotSchema.parse(dataWithContractor)).not.toThrow();
    });

    it('使用料情報が有効であること', () => {
      const dataWithUsageFee = {
        ...validPlotData,
        usageFee: {
          calculationType: 'area',
          taxType: 'included',
          billingType: 'annual',
          billingYears: '10',
          area: '3.5',
          unitPrice: '100000',
          usageFee: '350000',
          paymentMethod: 'bank_transfer',
        },
      };

      expect(() => createPlotSchema.parse(dataWithUsageFee)).not.toThrow();
    });

    it('管理料情報が有効であること', () => {
      const dataWithManagementFee = {
        ...validPlotData,
        managementFee: {
          calculationType: 'area',
          taxType: 'included',
          billingType: 'annual',
          billingYears: '1',
          area: '3.5',
          billingMonth: '4',
          managementFee: '5000',
          unitPrice: '1500',
          lastBillingMonth: '2024年3月',
          paymentMethod: 'bank_transfer',
        },
      };

      expect(() => createPlotSchema.parse(dataWithManagementFee)).not.toThrow();
    });

    it('請求情報が有効であること', () => {
      const dataWithBillingInfo = {
        ...validPlotData,
        billingInfo: {
          accountType: 'savings',
          bankName: 'みずほ銀行',
          branchName: '渋谷支店',
          accountNumber: '1234567',
          accountHolder: 'ヤマダタロウ',
          recipientType: 'applicant',
          recipientName: '山田太郎',
        },
      };

      expect(() => createPlotSchema.parse(dataWithBillingInfo)).not.toThrow();
    });

    it('家族連絡先配列が有効であること', () => {
      const dataWithFamilyContacts = {
        ...validPlotData,
        familyContacts: [
          {
            name: '山田次郎',
            birthDate: '1990-01-01',
            relationship: 'son',
            address: '東京都新宿区',
            phoneNumber: '090-1111-2222',
            faxNumber: '',
            email: 'jiro@example.com',
            registeredAddress: '東京都新宿区',
            mailingType: 'email',
            companyName: '株式会社テスト',
            companyNameKana: 'カブシキガイシャテスト',
            companyAddress: '東京都千代田区',
            companyPhone: '03-1111-2222',
            notes: '長男',
          },
        ],
      };

      expect(() => createPlotSchema.parse(dataWithFamilyContacts)).not.toThrow();
    });

    it('緊急連絡先が有効であること', () => {
      const dataWithEmergencyContact = {
        ...validPlotData,
        emergencyContact: {
          name: '山田花子',
          relationship: 'spouse',
          phoneNumber: '090-9999-8888',
        },
      };

      expect(() => createPlotSchema.parse(dataWithEmergencyContact)).not.toThrow();
    });

    it('埋葬者情報配列が有効であること', () => {
      const dataWithBuriedPersons = {
        ...validPlotData,
        buriedPersons: [
          {
            name: '山田一郎',
            nameKana: 'ヤマダイチロウ',
            relationship: 'father',
            deathDate: '2020-01-01',
            age: 80,
            gender: 'male',
            burialDate: '2020-01-05',
            graveNumber: 'A-001-1',
            notes: '父',
          },
        ],
      };

      expect(() => createPlotSchema.parse(dataWithBuriedPersons)).not.toThrow();
    });

    it('墓石情報が有効であること', () => {
      const dataWithGravestoneInfo = {
        ...validPlotData,
        gravestoneInfo: {
          gravestoneBase: '御影石',
          enclosurePosition: '南向き',
          gravestoneDealer: '石材店A',
          gravestoneType: '和型',
          surroundingArea: '芝生',
          establishmentDeadline: '2024-06-30',
          establishmentDate: '2024-06-15',
        },
      };

      expect(() => createPlotSchema.parse(dataWithGravestoneInfo)).not.toThrow();
    });

    it('工事情報が有効であること', () => {
      const dataWithConstructionInfo = {
        ...validPlotData,
        constructionInfo: {
          constructionType: '新設',
          startDate: '2024-05-01',
          completionDate: '2024-06-15',
          contractor: '建設業者A',
          supervisor: '田中主任',
          progress: '完了',
          workItem1: '基礎工事',
          workDate1: '2024-05-10',
          workAmount1: 500000,
          workStatus1: '完了',
          workItem2: '墓石設置',
          workDate2: '2024-06-01',
          workAmount2: 800000,
          workStatus2: '完了',
          permitNumber: 'P-2024-001',
          applicationDate: '2024-04-15',
          permitDate: '2024-04-25',
          permitStatus: '許可済',
          paymentType1: '頭金',
          paymentAmount1: 500000,
          paymentDate1: '2024-05-01',
          paymentStatus1: '支払済',
          paymentType2: '残金',
          paymentAmount2: 800000,
          paymentScheduledDate2: '2024-06-30',
          paymentStatus2: '未払',
          constructionNotes: '順調に完了',
        },
      };

      expect(() => createPlotSchema.parse(dataWithConstructionInfo)).not.toThrow();
    });

    it('備考が1000文字を超える場合エラーが発生すること', () => {
      const invalidData = { ...validPlotData, notes: 'あ'.repeat(1001) };
      expect(() => createPlotSchema.parse(invalidData)).toThrow();
    });

    it('面積が正の数値でない場合エラーが発生すること', () => {
      expect(() => createPlotSchema.parse({ ...validPlotData, area: -1 })).toThrow();
      expect(() => createPlotSchema.parse({ ...validPlotData, area: 0 })).toThrow();
    });
  });

  describe('updatePlotSchema', () => {
    it('有効な更新データでバリデーションが成功すること', () => {
      const validData = {
        gravestoneCode: 'A-002',
        usageStatus: 'reserved',
        notes: '更新テスト',
      };

      expect(() => updatePlotSchema.parse(validData)).not.toThrow();
    });

    it('全フィールドがオプションであること', () => {
      expect(() => updatePlotSchema.parse({})).not.toThrow();
      expect(() => updatePlotSchema.parse({ notes: '備考のみ更新' })).not.toThrow();
    });

    it('墓石番号のバリデーションルールが適用されること', () => {
      expect(() => updatePlotSchema.parse({ gravestoneCode: 'A-001' })).not.toThrow();
      expect(() => updatePlotSchema.parse({ gravestoneCode: 'a-001' })).toThrow();
      expect(() => updatePlotSchema.parse({ gravestoneCode: 'A'.repeat(51) })).toThrow();
    });

    it('部分的な申込者情報更新が可能であること', () => {
      const partialApplicant = {
        applicant: {
          name: '田中太郎',
          nameKana: 'タナカ タロウ',
        },
      };

      expect(() => updatePlotSchema.parse(partialApplicant)).not.toThrow();
    });

    it('家族連絡先の削除フラグが有効であること', () => {
      const dataWithDeleteFlag = {
        familyContacts: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            _delete: true,
          },
        ],
      };

      expect(() => updatePlotSchema.parse(dataWithDeleteFlag)).not.toThrow();
    });

    it('埋葬者情報の削除フラグが有効であること', () => {
      const dataWithDeleteFlag = {
        buriedPersons: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            _delete: true,
          },
        ],
      };

      expect(() => updatePlotSchema.parse(dataWithDeleteFlag)).not.toThrow();
    });

    it('請求情報の削除フラグが有効であること', () => {
      const dataWithDeleteFlag = {
        billingInfo: {
          id: '123e4567-e89b-12d3-a456-426614174000',
          _delete: true,
        },
      };

      expect(() => updatePlotSchema.parse(dataWithDeleteFlag)).not.toThrow();
    });
  });
});
