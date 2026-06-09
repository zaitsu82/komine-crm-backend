import { parseCsv } from '../../scripts/import-collective-burials';

describe('parseCsv (#359)', () => {
  it('単純な行をパースする', () => {
    expect(parseCsv('区画番号,埋葬上限数,合祀年数\n樹林-1,1,13\n')).toEqual([
      ['区画番号', '埋葬上限数', '合祀年数'],
      ['樹林-1', '1', '13'],
    ]);
  });

  it('引用符内のカンマ・改行・二重引用符を扱う', () => {
    const csv = '区画番号,備考\n"A,1","行1\n行2"\n"B","""引用"""\n';
    expect(parseCsv(csv)).toEqual([
      ['区画番号', '備考'],
      ['A,1', '行1\n行2'],
      ['B', '"引用"'],
    ]);
  });

  it('CRLF と BOM を吸収する', () => {
    expect(parseCsv('﻿区画番号,合祀年数\r\n樹林-1,13\r\n')).toEqual([
      ['区画番号', '合祀年数'],
      ['樹林-1', '13'],
    ]);
  });

  it('空行は除外する', () => {
    expect(parseCsv('a,b\n\n1,2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});
