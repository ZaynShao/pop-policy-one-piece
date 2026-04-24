import type { Pin } from '@/types';

export const SEED_PINS: Pin[] = [
  {
    id: 'pin_seed_1',
    creatorId: 'u_pmo',
    creatorName: '张 PMO',
    provinceCode: '440000',
    provinceName: '广东省',
    cityCode: '440300',
    cityName: '深圳市',
    title: '深圳 V2G 示范项目对接',
    goal: '月内完成深圳南山 V2G 示范项目政府侧对接，形成项目立项材料',
    status: 'active',
    comments: [
      {
        id: 'c_seed_1',
        userId: 'u_ga_guangdong',
        nickname: '李粤深',
        content: '已完成南山区科信局预沟通，待安排正式汇报',
        createdAt: '2026-04-16T10:00:00+08:00',
      },
    ],
    createdAt: '2026-04-10T09:00:00+08:00',
  },
  {
    id: 'pin_seed_2',
    creatorId: 'u_pmo',
    creatorName: '张 PMO',
    provinceCode: '330000',
    provinceName: '浙江省',
    cityCode: '330100',
    cityName: '杭州市',
    title: '杭州储能并网审批加速',
    goal: '推动杭州两个储能项目并网审批节奏',
    status: 'active',
    comments: [],
    createdAt: '2026-04-12T09:00:00+08:00',
  },
];
