import { REGIONS, type RegionNode } from '@/mock/regions';

// ECharts 的省份地图名用的是 GeoJSON `properties.name` 字段，
// 与 REGIONS 里的 name 基本一致（如"北京市"/"广东省"），但部分有差异：
// 例如 GeoJSON 可能用"内蒙古自治区"或"内蒙古"。先按原名匹配，再做 fallback。

export function provinceNameToCode(name: string): string | undefined {
  // 精确匹配
  const exact = REGIONS.find((p) => p.name === name);
  if (exact) return exact.code;
  // 模糊匹配（包含关系）
  const loose = REGIONS.find((p) => p.name.includes(name) || name.includes(p.name));
  return loose?.code;
}

export function cityNameToCode(
  provinceCode: string,
  cityName: string,
): string | undefined {
  const province = REGIONS.find((p) => p.code === provinceCode);
  if (!province?.children) return undefined;
  const exact = province.children.find((c) => c.name === cityName);
  if (exact) return exact.code;
  const loose = province.children.find(
    (c) => c.name.includes(cityName) || cityName.includes(c.name),
  );
  return loose?.code;
}

// 给定省级 code，列出所有市节点
export function listCitiesOfProvince(provinceCode: string): RegionNode[] {
  const province = REGIONS.find((p) => p.code === provinceCode);
  return province?.children ?? [];
}

// 是否直辖市（省级编码 = 市级编码 的场景）
export function isMunicipality(provinceCode: string): boolean {
  return ['110000', '120000', '310000', '500000'].includes(provinceCode);
}

// Cascader 选项（省/市/区三级）
export interface CascadeOption {
  value: string;
  label: string;
  children?: CascadeOption[];
}

export function buildCascadeOptions(): CascadeOption[] {
  return REGIONS.map((p) => ({
    value: p.code,
    label: p.name,
    children: p.children?.map((c) => ({
      value: c.code,
      label: c.name,
      children: c.children?.map((d) => ({ value: d.code, label: d.name })),
    })),
  }));
}
