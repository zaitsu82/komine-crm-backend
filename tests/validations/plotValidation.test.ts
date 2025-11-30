import {
  plotSearchQuerySchema,
  plotIdParamsSchema,
  createPlotSchema,
  updatePlotSchema,
  createPlotContractSchema,
} from '../../src/validations/plotValidation';

describe('Plot Validation (ContractPlot Model)', () => {
  describe('plotSearchQuerySchema', () => {
    it('有効な検索クエリでバリデーションが成功すること', () => {
      const validData = {
        page: '1',
        limit: '20',
        search: 'A-01',
        usageStatus: 'available',
        cemeteryType: 'general',
      };

      const result = plotSearchQuerySchema.parse(validData);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.search).toBe('A-01');
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
    const validCreatePlotData = {
      physicalPlot: {
        plotNumber: 'A-01',
        areaName: '一般墓地A',
        areaSqm: 3.6,
        notes: '',
      },
      contractPlot: {
        contractAreaSqm: 3.6,
        saleStatus: 'completed',
        locationDescription: '南側',
      },
      saleContract: {
        contractDate: '2024-01-01',
        price: 1000000,
        paymentStatus: 'paid',
        customerRole: 'applicant',
        reservationDate: '2023-12-15',
        acceptanceNumber: 'ACC-2024-001',
        permitDate: '2024-01-05',
        startDate: '2024-01-10',
        notes: '',
      },
      customer: {
        name: '山田太郎',
        nameKana: 'ヤマダタロウ',
        birthDate: '1980-01-01',
        gender: 'male',
        postalCode: '150-0001',
        address: '東京都渋谷区',
        registeredAddress: '東京都渋谷区',
        phoneNumber: '03-1234-5678',
        faxNumber: '',
        email: 'test@example.com',
        notes: '',
      },
    };

    it('有効な区画データでバリデーションが成功すること', () => {
      expect(() => createPlotSchema.parse(validCreatePlotData)).not.toThrow();
    });

    it('physicalPlotが必須であること', () => {
      const { physicalPlot, ...dataWithoutPhysicalPlot } = validCreatePlotData;
      expect(() => createPlotSchema.parse(dataWithoutPhysicalPlot)).toThrow();
    });

    it('contractPlotが必須であること', () => {
      const { contractPlot, ...dataWithoutContractPlot } = validCreatePlotData;
      expect(() => createPlotSchema.parse(dataWithoutContractPlot)).toThrow();
    });

    it('saleContractが必須であること', () => {
      const { saleContract, ...dataWithoutSaleContract } = validCreatePlotData;
      expect(() => createPlotSchema.parse(dataWithoutSaleContract)).toThrow();
    });

    it('customerが必須であること', () => {
      const { customer, ...dataWithoutCustomer } = validCreatePlotData;
      expect(() => createPlotSchema.parse(dataWithoutCustomer)).toThrow();
    });

    it('区画番号が50文字を超える場合エラーが発生すること', () => {
      const invalidData = {
        ...validCreatePlotData,
        physicalPlot: {
          ...validCreatePlotData.physicalPlot,
          plotNumber: 'A'.repeat(51),
        },
      };
      expect(() => createPlotSchema.parse(invalidData)).toThrow();
    });

    it('区画番号が大文字英数字とハイフンのみ使用できること', () => {
      // 有効なパターン
      expect(() =>
        createPlotSchema.parse({
          ...validCreatePlotData,
          physicalPlot: { ...validCreatePlotData.physicalPlot, plotNumber: 'A-001' },
        })
      ).not.toThrow();
      expect(() =>
        createPlotSchema.parse({
          ...validCreatePlotData,
          physicalPlot: { ...validCreatePlotData.physicalPlot, plotNumber: 'ABC123' },
        })
      ).not.toThrow();

      // 無効なパターン（小文字）
      expect(() =>
        createPlotSchema.parse({
          ...validCreatePlotData,
          physicalPlot: { ...validCreatePlotData.physicalPlot, plotNumber: 'a-001' },
        })
      ).toThrow();

      // 無効なパターン（アンダースコア）
      expect(() =>
        createPlotSchema.parse({
          ...validCreatePlotData,
          physicalPlot: { ...validCreatePlotData.physicalPlot, plotNumber: 'A_001' },
        })
      ).toThrow();
    });

    it('区域名が100文字を超える場合エラーが発生すること', () => {
      const invalidData = {
        ...validCreatePlotData,
        physicalPlot: {
          ...validCreatePlotData.physicalPlot,
          areaName: 'あ'.repeat(101),
        },
      };
      expect(() => createPlotSchema.parse(invalidData)).toThrow();
    });

    it('面積が正の数値であること', () => {
      // 有効なパターン
      expect(() =>
        createPlotSchema.parse({
          ...validCreatePlotData,
          physicalPlot: { ...validCreatePlotData.physicalPlot, areaSqm: 3.6 },
        })
      ).not.toThrow();

      // 無効なパターン（負の数）
      expect(() =>
        createPlotSchema.parse({
          ...validCreatePlotData,
          physicalPlot: { ...validCreatePlotData.physicalPlot, areaSqm: -1 },
        })
      ).toThrow();

      // 無効なパターン（ゼロ）
      expect(() =>
        createPlotSchema.parse({
          ...validCreatePlotData,
          physicalPlot: { ...validCreatePlotData.physicalPlot, areaSqm: 0 },
        })
      ).toThrow();
    });

    it('契約面積が正の数値であること', () => {
      // 有効なパターン
      expect(() =>
        createPlotSchema.parse({
          ...validCreatePlotData,
          contractPlot: { ...validCreatePlotData.contractPlot, contractAreaSqm: 3.6 },
        })
      ).not.toThrow();

      // 無効なパターン
      expect(() =>
        createPlotSchema.parse({
          ...validCreatePlotData,
          contractPlot: { ...validCreatePlotData.contractPlot, contractAreaSqm: -1 },
        })
      ).toThrow();
    });

    it('顧客名が必須であること', () => {
      const invalidData = {
        ...validCreatePlotData,
        customer: {
          ...validCreatePlotData.customer,
          name: '',
        },
      };
      expect(() => createPlotSchema.parse(invalidData)).toThrow();
    });

    it('顧客名が100文字以内であること', () => {
      const invalidData = {
        ...validCreatePlotData,
        customer: {
          ...validCreatePlotData.customer,
          name: 'あ'.repeat(101),
        },
      };
      expect(() => createPlotSchema.parse(invalidData)).toThrow();
    });

    it('顧客名カナがカタカナであること', () => {
      // 有効なパターン
      expect(() =>
        createPlotSchema.parse({
          ...validCreatePlotData,
          customer: { ...validCreatePlotData.customer, nameKana: 'ヤマダタロウ' },
        })
      ).not.toThrow();

      // 無効なパターン（ひらがな）
      expect(() =>
        createPlotSchema.parse({
          ...validCreatePlotData,
          customer: { ...validCreatePlotData.customer, nameKana: 'やまだたろう' },
        })
      ).toThrow();
    });

    it('郵便番号が必須であること', () => {
      const invalidData = {
        ...validCreatePlotData,
        customer: {
          ...validCreatePlotData.customer,
          postalCode: '',
        },
      };
      expect(() => createPlotSchema.parse(invalidData)).toThrow();
    });

    it('住所が必須であること', () => {
      const invalidData = {
        ...validCreatePlotData,
        customer: {
          ...validCreatePlotData.customer,
          address: '',
        },
      };
      expect(() => createPlotSchema.parse(invalidData)).toThrow();
    });

    it('契約日が必須であること', () => {
      const invalidData = {
        ...validCreatePlotData,
        saleContract: {
          ...validCreatePlotData.saleContract,
          contractDate: '' as any,
        },
      };
      expect(() => createPlotSchema.parse(invalidData)).toThrow();
    });

    it('価格が0以上の数値であること', () => {
      // 有効なパターン（0円）
      expect(() =>
        createPlotSchema.parse({
          ...validCreatePlotData,
          saleContract: { ...validCreatePlotData.saleContract, price: 0 },
        })
      ).not.toThrow();

      // 無効なパターン（負の数）
      expect(() =>
        createPlotSchema.parse({
          ...validCreatePlotData,
          saleContract: { ...validCreatePlotData.saleContract, price: -1 },
        })
      ).toThrow();
    });

    it('WorkInfo情報が有効であること（オプション）', () => {
      const dataWithWorkInfo = {
        ...validCreatePlotData,
        workInfo: {
          workPostalCode: '150-0001',
          workAddress: '東京都渋谷区',
          workPhoneNumber: '03-1234-5678',
          workFaxNumber: '',
        },
      };

      expect(() => createPlotSchema.parse(dataWithWorkInfo)).not.toThrow();
    });

    it('BillingInfo情報が有効であること（オプション）', () => {
      const dataWithBillingInfo = {
        ...validCreatePlotData,
        billingInfo: {
          billingType: 'bank_transfer',
          accountType: 'savings',
          bankName: 'みずほ銀行',
          branchName: '渋谷支店',
          accountNumber: '1234567',
          accountHolder: 'ヤマダタロウ',
        },
      };

      expect(() => createPlotSchema.parse(dataWithBillingInfo)).not.toThrow();
    });

    it('UsageFee情報が有効であること（オプション）', () => {
      const dataWithUsageFee = {
        ...validCreatePlotData,
        usageFee: {
          calculationType: 'area',
          taxType: 'included',
          billingType: 'annual',
          billingYears: '10',
          area: '3.6',
          unitPrice: '100000',
          usageFee: '360000',
          paymentMethod: 'bank_transfer',
        },
      };

      expect(() => createPlotSchema.parse(dataWithUsageFee)).not.toThrow();
    });

    it('ManagementFee情報が有効であること（オプション）', () => {
      const dataWithManagementFee = {
        ...validCreatePlotData,
        managementFee: {
          calculationType: 'area',
          taxType: 'included',
          billingType: 'annual',
          billingYears: '1',
          area: '3.6',
          billingMonth: '4',
          managementFee: '5000',
          unitPrice: '1500',
          lastBillingMonth: '2024年3月',
          paymentMethod: 'bank_transfer',
        },
      };

      expect(() => createPlotSchema.parse(dataWithManagementFee)).not.toThrow();
    });
  });

  describe('updatePlotSchema', () => {
    it('有効な更新データでバリデーションが成功すること', () => {
      const validData = {
        contractPlot: {
          saleStatus: 'completed',
        },
        saleContract: {
          paymentStatus: 'paid',
        },
      };

      expect(() => updatePlotSchema.parse(validData)).not.toThrow();
    });

    it('全フィールドがオプションであること', () => {
      expect(() => updatePlotSchema.parse({})).not.toThrow();
    });

    it('contractPlotのみ更新可能であること', () => {
      const validData = {
        contractPlot: {
          saleStatus: 'pending',
          locationDescription: '北側に変更',
        },
      };

      expect(() => updatePlotSchema.parse(validData)).not.toThrow();
    });

    it('saleContractのみ更新可能であること', () => {
      const validData = {
        saleContract: {
          paymentStatus: 'partial',
          notes: '分割払い',
        },
      };

      expect(() => updatePlotSchema.parse(validData)).not.toThrow();
    });

    it('customerのみ更新可能であること', () => {
      const validData = {
        customer: {
          phoneNumber: '090-1234-5678',
          email: 'updated@example.com',
        },
      };

      expect(() => updatePlotSchema.parse(validData)).not.toThrow();
    });

    it('複数セクション同時更新が可能であること', () => {
      const validData = {
        contractPlot: {
          saleStatus: 'completed',
        },
        saleContract: {
          paymentStatus: 'paid',
        },
        customer: {
          address: '東京都新宿区',
        },
      };

      expect(() => updatePlotSchema.parse(validData)).not.toThrow();
    });

    it('部分的なcustomer情報更新が可能であること', () => {
      const partialCustomer = {
        customer: {
          phoneNumber: '090-9999-8888',
        },
      };

      expect(() => updatePlotSchema.parse(partialCustomer)).not.toThrow();
    });

    it('WorkInfo更新が可能であること', () => {
      const validData = {
        workInfo: {
          workAddress: '東京都千代田区',
          workPhoneNumber: '03-9999-8888',
        },
      };

      expect(() => updatePlotSchema.parse(validData)).not.toThrow();
    });

    it('BillingInfo更新が可能であること', () => {
      const validData = {
        billingInfo: {
          bankName: '三菱UFJ銀行',
          branchName: '新宿支店',
        },
      };

      expect(() => updatePlotSchema.parse(validData)).not.toThrow();
    });

    it('UsageFee更新が可能であること', () => {
      const validData = {
        usageFee: {
          paymentMethod: 'credit_card',
        },
      };

      expect(() => updatePlotSchema.parse(validData)).not.toThrow();
    });

    it('ManagementFee更新が可能であること', () => {
      const validData = {
        managementFee: {
          lastBillingMonth: '2024年12月',
        },
      };

      expect(() => updatePlotSchema.parse(validData)).not.toThrow();
    });
  });

  describe('createPlotContractSchema', () => {
    const validContractData = {
      contractPlot: {
        contractAreaSqm: 1.8,
        saleStatus: 'completed',
        locationDescription: '東側',
      },
      saleContract: {
        contractDate: '2024-06-01',
        price: 500000,
        paymentStatus: 'paid',
        customerRole: 'contractor',
      },
      customer: {
        name: '田中花子',
        nameKana: 'タナカハナコ',
        postalCode: '150-0002',
        address: '東京都渋谷区',
        phoneNumber: '090-1234-5678',
        faxNumber: '',
      },
    };

    it('有効な契約データでバリデーションが成功すること', () => {
      expect(() => createPlotContractSchema.parse(validContractData)).not.toThrow();
    });

    it('physicalPlotフィールドは不要であること', () => {
      // physicalPlotがなくてもエラーにならない
      expect(() => createPlotContractSchema.parse(validContractData)).not.toThrow();
    });

    it('contractPlotが必須であること', () => {
      const { contractPlot, ...dataWithoutContractPlot } = validContractData;
      expect(() => createPlotContractSchema.parse(dataWithoutContractPlot)).toThrow();
    });

    it('saleContractが必須であること', () => {
      const { saleContract, ...dataWithoutSaleContract } = validContractData;
      expect(() => createPlotContractSchema.parse(dataWithoutSaleContract)).toThrow();
    });

    it('customerが必須であること', () => {
      const { customer, ...dataWithoutCustomer } = validContractData;
      expect(() => createPlotContractSchema.parse(dataWithoutCustomer)).toThrow();
    });

    it('オプションフィールドが有効であること', () => {
      const dataWithOptionalFields = {
        ...validContractData,
        workInfo: {
          workAddress: '東京都港区',
          workPhoneNumber: '03-5555-6666',
        },
        billingInfo: {
          accountType: 'checking',
          bankName: 'りそな銀行',
        },
        usageFee: {
          usageFee: '200000',
        },
        managementFee: {
          managementFee: '3000',
        },
      };

      expect(() => createPlotContractSchema.parse(dataWithOptionalFields)).not.toThrow();
    });
  });
});
