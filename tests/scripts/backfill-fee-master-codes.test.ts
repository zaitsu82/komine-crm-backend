import {
  mapFeeFieldValue,
  FEE_FIELD_SPECS,
  FeeFieldSpec,
} from '../../scripts/backfill-fee-master-codes';

const specByField = (field: string): FeeFieldSpec =>
  FEE_FIELD_SPECS.find((s) => s.field === field) as FeeFieldSpec;

describe('mapFeeFieldValue (#331)', () => {
  describe('calculation_type', () => {
    const spec = specByField('calculation_type');
    it('生int 0/1 を AREA/FIXED に揃える', () => {
      expect(mapFeeFieldValue(spec, '0')).toBe('AREA');
      expect(mapFeeFieldValue(spec, '1')).toBe('FIXED');
    });
    it('legacy-keisan-N 形式も揃える', () => {
      expect(mapFeeFieldValue(spec, 'legacy-keisan-0')).toBe('AREA');
      expect(mapFeeFieldValue(spec, 'legacy-keisan-1')).toBe('FIXED');
    });
    it('表記揺れ「面積単価」「01」を AREA に揃える', () => {
      expect(mapFeeFieldValue(spec, '面積単価')).toBe('AREA');
      expect(mapFeeFieldValue(spec, '01')).toBe('AREA');
    });
    it('既存の正コードは触らない', () => {
      expect(mapFeeFieldValue(spec, 'AREA')).toBeUndefined();
      expect(mapFeeFieldValue(spec, 'FIXED')).toBeUndefined();
    });
  });

  describe('tax_type', () => {
    const spec = specByField('tax_type');
    it('生int 0/1 を INCLUSIVE(内税)/EXCLUSIVE(外税) に揃える', () => {
      expect(mapFeeFieldValue(spec, '0')).toBe('INCLUSIVE');
      expect(mapFeeFieldValue(spec, '1')).toBe('EXCLUSIVE');
      expect(mapFeeFieldValue(spec, 'legacy-zei-1')).toBe('EXCLUSIVE');
    });
    it('レガシー意味に機械対応しない混入値（消費税10%/02）は温存する', () => {
      expect(mapFeeFieldValue(spec, '消費税10%')).toBeUndefined();
      expect(mapFeeFieldValue(spec, '02')).toBeUndefined();
    });
  });

  describe('billing_type', () => {
    const spec = specByField('billing_type');
    it('生int 0/1/2 を NONE(なし)/PRESENT(あり)/PERPETUAL(永代) に揃える', () => {
      expect(mapFeeFieldValue(spec, '0')).toBe('NONE');
      expect(mapFeeFieldValue(spec, '1')).toBe('PRESENT');
      expect(mapFeeFieldValue(spec, '2')).toBe('PERPETUAL');
      expect(mapFeeFieldValue(spec, 'legacy-seikyu-2')).toBe('PERPETUAL');
    });
    it('別語彙の混入値（一括請求/onetime）は温存する', () => {
      expect(mapFeeFieldValue(spec, '一括請求')).toBeUndefined();
      expect(mapFeeFieldValue(spec, 'onetime')).toBeUndefined();
    });
  });
});
