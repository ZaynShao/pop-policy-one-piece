import { create } from 'zustand';
import type { Policy } from '@/types';
import policiesJson from '@/mock/policies.json';

interface PolicyState {
  policies: Policy[];
}

export const usePolicyStore = create<PolicyState>(() => ({
  policies: policiesJson as Policy[],
}));
