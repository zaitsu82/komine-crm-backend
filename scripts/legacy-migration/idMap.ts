/**
 * レガシー int ID → 新システム UUID (or autoincrement Int) の対応表
 *
 * 全マップをメモリに保持。最大規模で
 *   customer: 3,487 / contract_plot: 6,250 / physical_plot: 6,250 / billing: 12,009
 * 程度なので問題なし。
 */
export class IdMap<K extends string | number, V> {
  private readonly map = new Map<K, V>();
  constructor(private readonly label: string) {}

  set(key: K, value: V): void {
    this.map.set(key, value);
  }

  get(key: K): V | undefined {
    return this.map.get(key);
  }

  require(key: K): V {
    const v = this.map.get(key);
    if (v === undefined) {
      throw new Error(`[idMap:${this.label}] missing key ${String(key)}`);
    }
    return v;
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  get size(): number {
    return this.map.size;
  }
}

export interface IdMaps {
  /** matant.TANCD → Staff.id (autoincrement Int) */
  staff: IdMap<number, number>;
  /** t_danka.danka_cd → Customer.id (UUID) */
  customer: IdMap<number, string>;
  /** m_bochi.grave_cd → PhysicalPlot.id (UUID) */
  physicalPlot: IdMap<number, string>;
  /** m_bochi.grave_cd → ContractPlot.id (UUID) */
  contractPlot: IdMap<number, string>;
  /** t_seikyu.seikyu_cd → Billing.id (UUID) */
  billing: IdMap<number, string>;
}

export function createIdMaps(): IdMaps {
  return {
    staff: new IdMap('staff'),
    customer: new IdMap('customer'),
    physicalPlot: new IdMap('physicalPlot'),
    contractPlot: new IdMap('contractPlot'),
    billing: new IdMap('billing'),
  };
}
