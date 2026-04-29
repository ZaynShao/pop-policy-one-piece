export interface StandaloneCity {
  provinceCode: string;
  cityName: string;
  shortLabel: string;  // 机构 shortName 用,例如「成都」
}

/** 13 个经济活跃城市,跨省级以外单独覆盖 7 口 */
export const STANDALONE_CITIES: StandaloneCity[] = [
  { provinceCode: '510000', cityName: '成都市', shortLabel: '成都' },
  { provinceCode: '440000', cityName: '深圳市', shortLabel: '深圳' },
  { provinceCode: '430000', cityName: '长沙市', shortLabel: '长沙' },
  { provinceCode: '440000', cityName: '东莞市', shortLabel: '东莞' },
  { provinceCode: '330000', cityName: '杭州市', shortLabel: '杭州' },
  { provinceCode: '410000', cityName: '郑州市', shortLabel: '郑州' },
  { provinceCode: '440000', cityName: '佛山市', shortLabel: '佛山' },
  { provinceCode: '320000', cityName: '苏州市', shortLabel: '苏州' },
  { provinceCode: '420000', cityName: '武汉市', shortLabel: '武汉' },
  { provinceCode: '320000', cityName: '南京市', shortLabel: '南京' },
  { provinceCode: '210000', cityName: '沈阳市', shortLabel: '沈阳' },
  { provinceCode: '370000', cityName: '青岛市', shortLabel: '青岛' },
  { provinceCode: '440000', cityName: '广州市', shortLabel: '广州' },
];
