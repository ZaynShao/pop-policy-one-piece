/**
 * 行政区划 code → 中文 region 名(对齐 ECharts GeoJSON properties.name)
 *
 * 用于 涂层 type:'map' series.data[].name 匹配 GeoJSON region:
 *   - 全国 GeoJSON:province name(北京市 / 上海市 / 广东省 / 四川省 ...)
 *   - 省级 GeoJSON:city name(广州市 / 成都市 ...)
 *
 * 仅覆盖 mockPolicyAnalysis + seed 用到的 28 个 code。
 * 后续接外部政策分析系统时,coverage 数据应直接带 name 不需查表。
 */
const REGION_NAMES: Record<string, string> = {
  // 省级(12)— 对应全国 GeoJSON properties.name
  '110000': '北京市',
  '310000': '上海市',
  '440000': '广东省',
  '510000': '四川省',
  '320000': '江苏省',
  '330000': '浙江省',
  '370000': '山东省',
  '420000': '湖北省',
  '430000': '湖南省',
  '500000': '重庆市',
  '610000': '陕西省',
  '350000': '福建省',
  // 市级(16)— 对应省级 GeoJSON properties.name
  '110100': '北京市',
  '310100': '上海市',
  '440100': '广州市',
  '440300': '深圳市',
  '510100': '成都市',
  '510700': '绵阳市',
  '320100': '南京市',
  '320500': '苏州市',
  '330100': '杭州市',
  '330200': '宁波市',
  '370100': '济南市',
  '420100': '武汉市',
  '430100': '长沙市',
  '500100': '重庆市',
  '610100': '西安市',
  '350100': '福州市',
  // 区级(seed 用到)
  '310101': '黄浦区',
};

export function regionCodeToName(code: string): string | null {
  return REGION_NAMES[code] ?? null;
}
