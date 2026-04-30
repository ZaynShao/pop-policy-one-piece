export interface StateCouncilDept {
  name: string;
  shortName: string;
  tags: string[];
}

/** 国务院组成部门 25 个核心 */
export const STATE_COUNCIL_DEPTS: StateCouncilDept[] = [
  { name: '国家发展和改革委员会', shortName: '国家发改委', tags: ['产业', '审批'] },
  { name: '工业和信息化部', shortName: '工信部', tags: ['工业', '数字化'] },
  { name: '科学技术部', shortName: '科技部', tags: ['科技', '创新'] },
  { name: '财政部', shortName: '财政部', tags: ['补贴', '资金'] },
  { name: '人力资源和社会保障部', shortName: '人社部', tags: ['人才', '就业'] },
  { name: '商务部', shortName: '商务部', tags: ['招商', '外贸'] },
  { name: '国家市场监督管理总局', shortName: '市场监管总局', tags: ['监管', '信用'] },
  { name: '教育部', shortName: '教育部', tags: ['教育'] },
  { name: '住房和城乡建设部', shortName: '住建部', tags: ['基建', '住房'] },
  { name: '交通运输部', shortName: '交通部', tags: ['交通', '物流'] },
  { name: '水利部', shortName: '水利部', tags: ['水利'] },
  { name: '农业农村部', shortName: '农业部', tags: ['农业'] },
  { name: '文化和旅游部', shortName: '文旅部', tags: ['文化', '旅游'] },
  { name: '国家卫生健康委员会', shortName: '卫健委', tags: ['卫生', '医疗'] },
  { name: '国家广播电视总局', shortName: '广电总局', tags: ['广电'] },
  { name: '国家税务总局', shortName: '税务总局', tags: ['税务'] },
  { name: '国家统计局', shortName: '统计局', tags: ['统计'] },
  { name: '国家知识产权局', shortName: '知识产权局', tags: ['知识产权'] },
  { name: '国家能源局', shortName: '能源局', tags: ['能源'] },
  { name: '国家林业和草原局', shortName: '林草局', tags: ['林业'] },
  { name: '国家粮食和物资储备局', shortName: '粮食局', tags: ['粮食'] },
  { name: '国家烟草专卖局', shortName: '烟草局', tags: ['烟草'] },
  { name: '国家移民管理局', shortName: '移民局', tags: ['移民'] },
  { name: '国务院国有资产监督管理委员会', shortName: '国资委', tags: ['国资'] },
  { name: '中国人民银行', shortName: '人民银行', tags: ['金融'] },
];
