import { create } from 'zustand';
import type { Pin, PinComment, PinStatus } from '@/types';
import { storage, genId } from '@/utils/storage';
import { SEED_PINS } from '@/mock/seedPins';

interface PinState {
  pins: Pin[];
  add: (p: Omit<Pin, 'id' | 'createdAt' | 'comments' | 'status'>) => Pin;
  addComment: (pinId: string, comment: Omit<PinComment, 'id' | 'createdAt'>) => void;
  removeComment: (pinId: string, commentId: string) => void;
  setStatus: (pinId: string, status: PinStatus) => void;
  remove: (pinId: string) => void;
}

const KEY = 'pins';

function load(): Pin[] {
  const saved = storage.get<Pin[] | null>(KEY, null);
  if (saved && saved.length > 0) return saved;
  storage.set(KEY, SEED_PINS);
  return SEED_PINS;
}

function persist(list: Pin[]) {
  storage.set(KEY, list);
}

export const usePinStore = create<PinState>((set, get) => ({
  pins: load(),
  add: (p) => {
    const pin: Pin = {
      ...p,
      id: genId('pin'),
      status: 'active',
      comments: [],
      createdAt: new Date().toISOString(),
    };
    const next = [pin, ...get().pins];
    persist(next);
    set({ pins: next });
    return pin;
  },
  addComment: (pinId, comment) => {
    const full: PinComment = {
      ...comment,
      id: genId('c'),
      createdAt: new Date().toISOString(),
    };
    const next = get().pins.map((p) =>
      p.id === pinId ? { ...p, comments: [...p.comments, full] } : p,
    );
    persist(next);
    set({ pins: next });
  },
  removeComment: (pinId, commentId) => {
    const next = get().pins.map((p) =>
      p.id === pinId ? { ...p, comments: p.comments.filter((c) => c.id !== commentId) } : p,
    );
    persist(next);
    set({ pins: next });
  },
  setStatus: (pinId, status) => {
    const next = get().pins.map((p) => (p.id === pinId ? { ...p, status } : p));
    persist(next);
    set({ pins: next });
  },
  remove: (pinId) => {
    const next = get().pins.filter((p) => p.id !== pinId);
    persist(next);
    set({ pins: next });
  },
}));
