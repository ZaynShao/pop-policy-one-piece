export interface ProvincialDeptTemplate {
  /** 后缀(省/自治区版),直辖市自动改 */
  suffix: string;
  short: string;
  tags: string[];
}

/** 7 个核心口模板(省级用「厅」,直辖市/中央省级用「局」) */
export const PROVINCIAL_DEPT_TEMPLATE: ProvincialDeptTemplate[] = [
  { suffix: '发展和改革委员会', short: '发改委', tags: ['产业', '审批'] },
  { suffix: '工业和信息化厅', short: '工信厅', tags: ['工业', '制造业'] },
  { suffix: '科学技术厅', short: '科技厅', tags: ['科技', '创新'] },
  { suffix: '财政厅', short: '财政厅', tags: ['补贴', '资金'] },
  { suffix: '人力资源和社会保障厅', short: '人社厅', tags: ['人才', '就业'] },
  { suffix: '商务厅', short: '商务厅', tags: ['招商', '外贸'] },
  { suffix: '市场监督管理局', short: '市场监管局', tags: ['监管', '信用'] },
];

export interface ProvinceMeta {
  /** 6 位省级 code */
  code: string;
  /** 类型:省 / 自治区 / 直辖市 */
  kind: 'province' | 'autonomous' | 'municipality';
  /** 全称(用于命名机构),例如「湖南省」「内蒙古自治区」「北京市」 */
  fullLabel: string;
  /** 短称(机构 shortName 用),例如「湖南」「内蒙古」「北京」 */
  shortLabel: string;
  /** 首府/府(中央用首府) */
  capital: string;
}

/** 31 = 23 省 - 1 台湾 + 5 自治区 + 4 直辖市 */
export const PROVINCES: ProvinceMeta[] = [
  // 4 直辖市
  { code: '110000', kind: 'municipality', fullLabel: '北京市', shortLabel: '北京', capital: '北京市' },
  { code: '120000', kind: 'municipality', fullLabel: '天津市', shortLabel: '天津', capital: '天津市' },
  { code: '310000', kind: 'municipality', fullLabel: '上海市', shortLabel: '上海', capital: '上海市' },
  { code: '500000', kind: 'municipality', fullLabel: '重庆市', shortLabel: '重庆', capital: '重庆市' },
  // 5 自治区
  { code: '150000', kind: 'autonomous', fullLabel: '内蒙古自治区', shortLabel: '内蒙古', capital: '呼和浩特市' },
  { code: '450000', kind: 'autonomous', fullLabel: '广西壮族自治区', shortLabel: '广西', capital: '南宁市' },
  { code: '540000', kind: 'autonomous', fullLabel: '西藏自治区', shortLabel: '西藏', capital: '拉萨市' },
  { code: '640000', kind: 'autonomous', fullLabel: '宁夏回族自治区', shortLabel: '宁夏', capital: '银川市' },
  { code: '650000', kind: 'autonomous', fullLabel: '新疆维吾尔自治区', shortLabel: '新疆', capital: '乌鲁木齐市' },
  // 22 省(去台湾)
  { code: '130000', kind: 'province', fullLabel: '河北省', shortLabel: '河北', capital: '石家庄市' },
  { code: '140000', kind: 'province', fullLabel: '山西省', shortLabel: '山西', capital: '太原市' },
  { code: '210000', kind: 'province', fullLabel: '辽宁省', shortLabel: '辽宁', capital: '沈阳市' },
  { code: '220000', kind: 'province', fullLabel: '吉林省', shortLabel: '吉林', capital: '长春市' },
  { code: '230000', kind: 'province', fullLabel: '黑龙江省', shortLabel: '黑龙江', capital: '哈尔滨市' },
  { code: '320000', kind: 'province', fullLabel: '江苏省', shortLabel: '江苏', capital: '南京市' },
  { code: '330000', kind: 'province', fullLabel: '浙江省', shortLabel: '浙江', capital: '杭州市' },
  { code: '340000', kind: 'province', fullLabel: '安徽省', shortLabel: '安徽', capital: '合肥市' },
  { code: '350000', kind: 'province', fullLabel: '福建省', shortLabel: '福建', capital: '福州市' },
  { code: '360000', kind: 'province', fullLabel: '江西省', shortLabel: '江西', capital: '南昌市' },
  { code: '370000', kind: 'province', fullLabel: '山东省', shortLabel: '山东', capital: '济南市' },
  { code: '410000', kind: 'province', fullLabel: '河南省', shortLabel: '河南', capital: '郑州市' },
  { code: '420000', kind: 'province', fullLabel: '湖北省', shortLabel: '湖北', capital: '武汉市' },
  { code: '430000', kind: 'province', fullLabel: '湖南省', shortLabel: '湖南', capital: '长沙市' },
  { code: '440000', kind: 'province', fullLabel: '广东省', shortLabel: '广东', capital: '广州市' },
  { code: '460000', kind: 'province', fullLabel: '海南省', shortLabel: '海南', capital: '海口市' },
  { code: '510000', kind: 'province', fullLabel: '四川省', shortLabel: '四川', capital: '成都市' },
  { code: '520000', kind: 'province', fullLabel: '贵州省', shortLabel: '贵州', capital: '贵阳市' },
  { code: '530000', kind: 'province', fullLabel: '云南省', shortLabel: '云南', capital: '昆明市' },
  { code: '610000', kind: 'province', fullLabel: '陕西省', shortLabel: '陕西', capital: '西安市' },
  { code: '620000', kind: 'province', fullLabel: '甘肃省', shortLabel: '甘肃', capital: '兰州市' },
  { code: '630000', kind: 'province', fullLabel: '青海省', shortLabel: '青海', capital: '西宁市' },
];
