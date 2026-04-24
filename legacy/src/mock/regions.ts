export interface RegionNode {
  code: string;
  name: string;
  // 经纬度（仅市/区级别需要，用于地图打点）
  lng?: number;
  lat?: number;
  children?: RegionNode[];
}

// 行政区划（精简版，原型用）
// 省级 34 个 + 每省若干代表性地市 + 热点城市的区
// 坐标为各地政府驻地近似值
export const REGIONS: RegionNode[] = [
  {
    code: '110000',
    name: '北京市',
    lng: 116.405285,
    lat: 39.904989,
    children: [
      { code: '110101', name: '东城区', lng: 116.418757, lat: 39.917544 },
      { code: '110102', name: '西城区', lng: 116.365868, lat: 39.912289 },
      { code: '110105', name: '朝阳区', lng: 116.443118, lat: 39.921511 },
      { code: '110106', name: '丰台区', lng: 116.286968, lat: 39.863642 },
      { code: '110108', name: '海淀区', lng: 116.298056, lat: 39.959912 },
      { code: '110109', name: '门头沟区', lng: 116.105381, lat: 39.937183 },
      { code: '110111', name: '房山区', lng: 116.143267, lat: 39.749144 },
      { code: '110112', name: '通州区', lng: 116.656435, lat: 39.909946 },
    ],
  },
  {
    code: '120000',
    name: '天津市',
    lng: 117.190182,
    lat: 39.125596,
    children: [
      { code: '120101', name: '和平区', lng: 117.214513, lat: 39.117144 },
      { code: '120102', name: '河东区', lng: 117.251585, lat: 39.120203 },
      { code: '120104', name: '南开区', lng: 117.150738, lat: 39.138203 },
      { code: '120116', name: '滨海新区', lng: 117.698407, lat: 39.01727 },
    ],
  },
  {
    code: '130000',
    name: '河北省',
    children: [
      { code: '130100', name: '石家庄市', lng: 114.502461, lat: 38.045474 },
      { code: '130200', name: '唐山市', lng: 118.175393, lat: 39.635113 },
      { code: '130400', name: '邯郸市', lng: 114.490686, lat: 36.612273 },
      { code: '130600', name: '保定市', lng: 115.482331, lat: 38.867657 },
      { code: '130900', name: '沧州市', lng: 116.857461, lat: 38.310582 },
      { code: '131000', name: '廊坊市', lng: 116.704441, lat: 39.523927 },
    ],
  },
  {
    code: '140000',
    name: '山西省',
    children: [
      { code: '140100', name: '太原市', lng: 112.549248, lat: 37.857014 },
      { code: '140200', name: '大同市', lng: 113.295259, lat: 40.09031 },
      { code: '140500', name: '晋城市', lng: 112.851274, lat: 35.497553 },
      { code: '140800', name: '运城市', lng: 111.003957, lat: 35.022778 },
    ],
  },
  {
    code: '150000',
    name: '内蒙古自治区',
    children: [
      { code: '150100', name: '呼和浩特市', lng: 111.670801, lat: 40.818311 },
      { code: '150200', name: '包头市', lng: 109.840405, lat: 40.658168 },
      { code: '150600', name: '鄂尔多斯市', lng: 109.99029, lat: 39.817179 },
    ],
  },
  {
    code: '210000',
    name: '辽宁省',
    children: [
      { code: '210100', name: '沈阳市', lng: 123.429096, lat: 41.796767 },
      { code: '210200', name: '大连市', lng: 121.618622, lat: 38.91459 },
      { code: '210400', name: '抚顺市', lng: 123.921109, lat: 41.875956 },
      { code: '210700', name: '锦州市', lng: 121.135742, lat: 41.119269 },
    ],
  },
  {
    code: '220000',
    name: '吉林省',
    children: [
      { code: '220100', name: '长春市', lng: 125.3245, lat: 43.886841 },
      { code: '220200', name: '吉林市', lng: 126.55302, lat: 43.843577 },
    ],
  },
  {
    code: '230000',
    name: '黑龙江省',
    children: [
      { code: '230100', name: '哈尔滨市', lng: 126.642464, lat: 45.756967 },
      { code: '230600', name: '大庆市', lng: 125.11272, lat: 46.590734 },
    ],
  },
  {
    code: '310000',
    name: '上海市',
    lng: 121.472644,
    lat: 31.231706,
    children: [
      { code: '310101', name: '黄浦区', lng: 121.490317, lat: 31.222771 },
      { code: '310104', name: '徐汇区', lng: 121.43676, lat: 31.188591 },
      { code: '310105', name: '长宁区', lng: 121.424622, lat: 31.220367 },
      { code: '310106', name: '静安区', lng: 121.447343, lat: 31.227739 },
      { code: '310107', name: '普陀区', lng: 121.395514, lat: 31.249618 },
      { code: '310115', name: '浦东新区', lng: 121.544379, lat: 31.221517 },
      { code: '310117', name: '松江区', lng: 121.227747, lat: 31.032241 },
    ],
  },
  {
    code: '320000',
    name: '江苏省',
    children: [
      { code: '320100', name: '南京市', lng: 118.767413, lat: 32.041544 },
      { code: '320200', name: '无锡市', lng: 120.301663, lat: 31.574729 },
      { code: '320500', name: '苏州市', lng: 120.619585, lat: 31.299379 },
      { code: '320600', name: '南通市', lng: 120.864608, lat: 32.016212 },
      { code: '320700', name: '连云港市', lng: 119.178821, lat: 34.600018 },
      { code: '321200', name: '泰州市', lng: 119.915176, lat: 32.484882 },
    ],
  },
  {
    code: '330000',
    name: '浙江省',
    children: [
      {
        code: '330100',
        name: '杭州市',
        lng: 120.153576,
        lat: 30.287459,
        children: [
          { code: '330102', name: '上城区', lng: 120.165307, lat: 30.242851 },
          { code: '330105', name: '拱墅区', lng: 120.141406, lat: 30.319631 },
          { code: '330106', name: '西湖区', lng: 120.130203, lat: 30.259244 },
          { code: '330108', name: '滨江区', lng: 120.211517, lat: 30.208748 },
          { code: '330110', name: '余杭区', lng: 120.299732, lat: 30.419822 },
        ],
      },
      { code: '330200', name: '宁波市', lng: 121.549792, lat: 29.868388 },
      { code: '330300', name: '温州市', lng: 120.672111, lat: 28.000575 },
      { code: '330400', name: '嘉兴市', lng: 120.750865, lat: 30.762653 },
      { code: '330500', name: '湖州市', lng: 120.102398, lat: 30.867198 },
      { code: '330600', name: '绍兴市', lng: 120.582112, lat: 29.997117 },
      { code: '330700', name: '金华市', lng: 119.649506, lat: 29.089524 },
    ],
  },
  {
    code: '340000',
    name: '安徽省',
    children: [
      { code: '340100', name: '合肥市', lng: 117.283042, lat: 31.86119 },
      { code: '340200', name: '芜湖市', lng: 118.376451, lat: 31.326319 },
      { code: '340700', name: '铜陵市', lng: 117.816576, lat: 30.929935 },
    ],
  },
  {
    code: '350000',
    name: '福建省',
    children: [
      { code: '350100', name: '福州市', lng: 119.306239, lat: 26.075302 },
      { code: '350200', name: '厦门市', lng: 118.11022, lat: 24.490474 },
      { code: '350500', name: '泉州市', lng: 118.589421, lat: 24.908853 },
    ],
  },
  {
    code: '360000',
    name: '江西省',
    children: [
      { code: '360100', name: '南昌市', lng: 115.892151, lat: 28.676493 },
      { code: '360700', name: '赣州市', lng: 114.940278, lat: 25.85097 },
    ],
  },
  {
    code: '370000',
    name: '山东省',
    children: [
      { code: '370100', name: '济南市', lng: 117.000923, lat: 36.675807 },
      { code: '370200', name: '青岛市', lng: 120.355173, lat: 36.082982 },
      { code: '370600', name: '烟台市', lng: 121.391382, lat: 37.539297 },
      { code: '370700', name: '潍坊市', lng: 119.107078, lat: 36.70925 },
      { code: '370800', name: '济宁市', lng: 116.587245, lat: 35.415393 },
    ],
  },
  {
    code: '410000',
    name: '河南省',
    children: [
      { code: '410100', name: '郑州市', lng: 113.665412, lat: 34.757975 },
      { code: '410300', name: '洛阳市', lng: 112.434468, lat: 34.663041 },
      { code: '410700', name: '新乡市', lng: 113.883991, lat: 35.302616 },
    ],
  },
  {
    code: '420000',
    name: '湖北省',
    children: [
      { code: '420100', name: '武汉市', lng: 114.298572, lat: 30.584355 },
      { code: '420500', name: '宜昌市', lng: 111.290843, lat: 30.702636 },
      { code: '420600', name: '襄阳市', lng: 112.144146, lat: 32.042426 },
    ],
  },
  {
    code: '430000',
    name: '湖南省',
    children: [
      { code: '430100', name: '长沙市', lng: 112.982279, lat: 28.19409 },
      { code: '430400', name: '衡阳市', lng: 112.607693, lat: 26.900358 },
      { code: '430700', name: '常德市', lng: 111.691347, lat: 29.040225 },
    ],
  },
  {
    code: '440000',
    name: '广东省',
    children: [
      {
        code: '440100',
        name: '广州市',
        lng: 113.280637,
        lat: 23.125178,
        children: [
          { code: '440103', name: '荔湾区', lng: 113.244261, lat: 23.125822 },
          { code: '440104', name: '越秀区', lng: 113.266841, lat: 23.129155 },
          { code: '440106', name: '天河区', lng: 113.360806, lat: 23.124695 },
          { code: '440113', name: '番禺区', lng: 113.384152, lat: 22.937556 },
        ],
      },
      {
        code: '440300',
        name: '深圳市',
        lng: 114.085947,
        lat: 22.547,
        children: [
          { code: '440303', name: '罗湖区', lng: 114.131979, lat: 22.548389 },
          { code: '440304', name: '福田区', lng: 114.055039, lat: 22.521836 },
          { code: '440305', name: '南山区', lng: 113.930413, lat: 22.533001 },
          { code: '440306', name: '宝安区', lng: 113.884152, lat: 22.555179 },
          { code: '440307', name: '龙岗区', lng: 114.246899, lat: 22.720971 },
        ],
      },
      { code: '440400', name: '珠海市', lng: 113.553986, lat: 22.224979 },
      { code: '440600', name: '佛山市', lng: 113.122717, lat: 23.028762 },
      { code: '441900', name: '东莞市', lng: 113.746262, lat: 23.046237 },
      { code: '442000', name: '中山市', lng: 113.382391, lat: 22.521113 },
    ],
  },
  {
    code: '450000',
    name: '广西壮族自治区',
    children: [
      { code: '450100', name: '南宁市', lng: 108.320004, lat: 22.82402 },
      { code: '450300', name: '桂林市', lng: 110.299121, lat: 25.274215 },
      { code: '450700', name: '钦州市', lng: 108.624175, lat: 21.967127 },
    ],
  },
  {
    code: '460000',
    name: '海南省',
    children: [
      { code: '460100', name: '海口市', lng: 110.33119, lat: 20.031971 },
      { code: '460200', name: '三亚市', lng: 109.508268, lat: 18.247872 },
    ],
  },
  {
    code: '500000',
    name: '重庆市',
    lng: 106.504962,
    lat: 29.533155,
    children: [
      { code: '500103', name: '渝中区', lng: 106.56288, lat: 29.556742 },
      { code: '500105', name: '江北区', lng: 106.574271, lat: 29.60658 },
      { code: '500106', name: '沙坪坝区', lng: 106.454692, lat: 29.541145 },
      { code: '500107', name: '九龙坡区', lng: 106.510635, lat: 29.502091 },
      { code: '500112', name: '渝北区', lng: 106.630867, lat: 29.718879 },
    ],
  },
  {
    code: '510000',
    name: '四川省',
    children: [
      { code: '510100', name: '成都市', lng: 104.065735, lat: 30.659462 },
      { code: '510300', name: '自贡市', lng: 104.773447, lat: 29.352765 },
      { code: '510500', name: '泸州市', lng: 105.443348, lat: 28.889138 },
      { code: '510700', name: '绵阳市', lng: 104.741722, lat: 31.46402 },
    ],
  },
  {
    code: '520000',
    name: '贵州省',
    children: [
      { code: '520100', name: '贵阳市', lng: 106.713478, lat: 26.578343 },
      { code: '520200', name: '六盘水市', lng: 104.846743, lat: 26.584643 },
    ],
  },
  {
    code: '530000',
    name: '云南省',
    children: [
      { code: '530100', name: '昆明市', lng: 102.712251, lat: 25.040609 },
      { code: '530300', name: '曲靖市', lng: 103.797851, lat: 25.501557 },
    ],
  },
  {
    code: '540000',
    name: '西藏自治区',
    children: [{ code: '540100', name: '拉萨市', lng: 91.132212, lat: 29.660361 }],
  },
  {
    code: '610000',
    name: '陕西省',
    children: [
      { code: '610100', name: '西安市', lng: 108.948024, lat: 34.263161 },
      { code: '610400', name: '咸阳市', lng: 108.705117, lat: 34.333439 },
      { code: '610600', name: '延安市', lng: 109.49081, lat: 36.596537 },
    ],
  },
  {
    code: '620000',
    name: '甘肃省',
    children: [
      { code: '620100', name: '兰州市', lng: 103.823557, lat: 36.058039 },
      { code: '620900', name: '酒泉市', lng: 98.510795, lat: 39.744023 },
    ],
  },
  {
    code: '630000',
    name: '青海省',
    children: [{ code: '630100', name: '西宁市', lng: 101.778916, lat: 36.623178 }],
  },
  {
    code: '640000',
    name: '宁夏回族自治区',
    children: [{ code: '640100', name: '银川市', lng: 106.278179, lat: 38.46637 }],
  },
  {
    code: '650000',
    name: '新疆维吾尔自治区',
    children: [
      { code: '650100', name: '乌鲁木齐市', lng: 87.617733, lat: 43.792818 },
      { code: '652700', name: '博尔塔拉蒙古自治州', lng: 82.074778, lat: 44.903258 },
    ],
  },
  {
    code: '710000',
    name: '台湾省',
    children: [{ code: '710100', name: '台北市', lng: 121.509062, lat: 25.044332 }],
  },
  {
    code: '810000',
    name: '香港特别行政区',
    lng: 114.173355,
    lat: 22.320048,
  },
  {
    code: '820000',
    name: '澳门特别行政区',
    lng: 113.54909,
    lat: 22.198951,
  },
];

// 查找工具
export function findProvince(code: string): RegionNode | undefined {
  return REGIONS.find((p) => p.code === code);
}

export function findCity(provinceCode: string, cityCode: string): RegionNode | undefined {
  return findProvince(provinceCode)?.children?.find((c) => c.code === cityCode);
}

export function findDistrict(
  provinceCode: string,
  cityCode: string,
  districtCode: string,
): RegionNode | undefined {
  // 直辖市的"区"挂在省级下面
  const province = findProvince(provinceCode);
  if (!province) return undefined;
  if (provinceCode === cityCode) {
    return province.children?.find((d) => d.code === districtCode);
  }
  const city = province.children?.find((c) => c.code === cityCode);
  return city?.children?.find((d) => d.code === districtCode);
}

// 点位坐标查找（优先级：区 > 市 > 省）
export function resolveCoord(
  provinceCode: string,
  cityCode?: string,
  districtCode?: string,
): [number, number] | null {
  if (districtCode) {
    const d = findDistrict(provinceCode, cityCode ?? provinceCode, districtCode);
    if (d?.lng != null && d?.lat != null) return [d.lng, d.lat];
  }
  if (cityCode) {
    const c = findCity(provinceCode, cityCode);
    if (c?.lng != null && c?.lat != null) return [c.lng, c.lat];
    // 直辖市的 cityCode 可能等于 provinceCode
    const province = findProvince(provinceCode);
    if (province?.lng != null && province?.lat != null) {
      return [province.lng, province.lat];
    }
  }
  const p = findProvince(provinceCode);
  if (p?.lng != null && p?.lat != null) return [p.lng, p.lat];
  return null;
}

// 省级 code → GeoJSON 文件名映射（DataV adcode，全国用 100000_full）
export function provinceMapKey(provinceCode: string): string {
  return `province_${provinceCode}`;
}
