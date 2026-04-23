import { create } from 'zustand';
import type { VisitRecord } from '@/types';
import { storage, genId } from '@/utils/storage';
import { SEED_VISITS } from '@/mock/seedVisits';

interface VisitState {
  visits: VisitRecord[];
  add: (v: Omit<VisitRecord, 'id' | 'createdAt'>) => VisitRecord;
  update: (id: string, patch: Partial<VisitRecord>) => void;
  remove: (id: string) => void;
  resetSeed: () => void;
}

const KEY = 'visits';

function load(): VisitRecord[] {
  const saved = storage.get<VisitRecord[] | null>(KEY, null);
  if (saved && saved.length > 0) return saved;
  storage.set(KEY, SEED_VISITS);
  return SEED_VISITS;
}

function persist(list: VisitRecord[]) {
  storage.set(KEY, list);
}

export const useVisitStore = create<VisitState>((set, get) => ({
  visits: load(),
  add: (v) => {
    const record: VisitRecord = {
      ...v,
      id: genId('v'),
      createdAt: new Date().toISOString(),
    };
    const next = [record, ...get().visits];
    persist(next);
    set({ visits: next });
    return record;
  },
  update: (id, patch) => {
    const next = get().visits.map((v) => (v.id === id ? { ...v, ...patch } : v));
    persist(next);
    set({ visits: next });
  },
  remove: (id) => {
    const next = get().visits.filter((v) => v.id !== id);
    persist(next);
    set({ visits: next });
  },
  resetSeed: () => {
    persist(SEED_VISITS);
    set({ visits: SEED_VISITS });
  },
}));
