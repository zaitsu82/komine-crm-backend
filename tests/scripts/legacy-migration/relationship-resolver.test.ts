/**
 * 続柄解決ヘルパーの単体テスト（#333）
 */
import type { PrismaClient } from '@prisma/client';

import {
  LEGACY_UNKNOWN_RELATIONSHIP,
  loadRelationshipNameMap,
  resolveRelationship,
  UNRESOLVED_RELATIONSHIP,
} from '../../../scripts/legacy-migration/lib/relationship-resolver';

describe('loadRelationshipNameMap', () => {
  it('code `2009-N` から NMCODE→名称 の対応表を作る', async () => {
    const prisma = {
      relationshipMaster: {
        findMany: jest.fn().mockResolvedValue([
          { code: '2009-1', name: '本人' },
          { code: '2009-13', name: '配偶者' },
          { code: 'other-5', name: '無関係' }, // 2009- 以外は無視
        ]),
      },
    } as unknown as PrismaClient;

    const map = await loadRelationshipNameMap(prisma);
    expect(map.get('1')).toBe('本人');
    expect(map.get('13')).toBe('配偶者');
    expect(map.has('5')).toBe(false);
  });
});

describe('resolveRelationship', () => {
  const nameMap = new Map<string, string>([
    ['1', '本人'],
    ['13', '配偶者'],
  ]);

  it('マスタにある生int は名称へ解決する', () => {
    expect(resolveRelationship('13', nameMap)).toBe('配偶者');
    expect(resolveRelationship('1', nameMap)).toBe('本人');
  });

  it("'0' やマスタ未登録の数字は空文字（未設定）になる (#375)", () => {
    expect(resolveRelationship('0', nameMap)).toBe('');
    expect(resolveRelationship('99', nameMap)).toBe('');
  });

  it('null/空は空文字 (#375)', () => {
    expect(resolveRelationship(null, nameMap)).toBe('');
    expect(resolveRelationship('   ', nameMap)).toBe('');
  });

  it('数字でない自由記述はそのまま（既に名称）', () => {
    expect(resolveRelationship('配偶者', nameMap)).toBe('配偶者');
    expect(resolveRelationship('友人', nameMap)).toBe('友人');
  });

  it('未解決センチネルは空文字・旧センチネルは英語unknown (#375)', () => {
    expect(UNRESOLVED_RELATIONSHIP).toBe('');
    expect(LEGACY_UNKNOWN_RELATIONSHIP).toBe('unknown');
    // 解決できない値は新センチネル（空文字）に揃う
    expect(resolveRelationship('0', nameMap)).toBe(UNRESOLVED_RELATIONSHIP);
  });
});
