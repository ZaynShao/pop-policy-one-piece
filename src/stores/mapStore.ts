import { create } from 'zustand';
import type { MapMode } from '@/types';

interface MapState {
  mode: MapMode; // 'region' = 属地大盘, 'policy' = 政策大盘
  currentProvinceCode: string | null; // null = 全国视图；非空 = 下钻到某省
  selectedPolicyIds: string[]; // 政策大盘勾选的政策
  setMode: (mode: MapMode) => void;
  drillTo: (provinceCode: string | null) => void;
  togglePolicy: (id: string) => void;
  setSelectedPolicies: (ids: string[]) => void;
}

export const useMapStore = create<MapState>((set) => ({
  mode: 'region',
  currentProvinceCode: null,
  selectedPolicyIds: [],
  setMode: (mode) => set({ mode }),
  drillTo: (provinceCode) => set({ currentProvinceCode: provinceCode }),
  togglePolicy: (id) =>
    set((s) => ({
      selectedPolicyIds: s.selectedPolicyIds.includes(id)
        ? s.selectedPolicyIds.filter((x) => x !== id)
        : [...s.selectedPolicyIds, id],
    })),
  setSelectedPolicies: (ids) => set({ selectedPolicyIds: ids }),
}));
