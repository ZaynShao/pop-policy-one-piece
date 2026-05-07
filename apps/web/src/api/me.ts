import type { Visit, Pin } from '@pop/shared-types';
import dayjs from 'dayjs';
import { fetchVisits } from './visits';
import { fetchPins } from './pins';

/**
 * F1 当日动作 / F2 我的条目 共用的客户端聚合层。
 *
 * 注:V0 阶段直接拉全集后客户端过滤;visits / pins 总量小(<100 条),
 * 性能可接受。规模扩大(>1000 条)后再加后端 /me 聚合 endpoint。
 */

export interface MyItems {
  visits: Visit[];
  pins: Pin[];
}

export async function fetchMyAllItems(currentUserId: string): Promise<MyItems> {
  const [v, p] = await Promise.all([fetchVisits(), fetchPins()]);
  return {
    visits: v.data.filter((x) => x.visitorId === currentUserId),
    pins: p.data.filter((x) => x.createdBy === currentUserId),
  };
}

export async function fetchMyTodayItems(currentUserId: string): Promise<MyItems> {
  const all = await fetchMyAllItems(currentUserId);
  const start = dayjs().startOf('day');
  return {
    visits: all.visits.filter((x) => dayjs(x.createdAt).isAfter(start)),
    pins: all.pins.filter((x) => dayjs(x.createdAt).isAfter(start)),
  };
}
