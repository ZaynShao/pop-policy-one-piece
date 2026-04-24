import { create } from 'zustand';
import type { User } from '@/types';
import { storage } from '@/utils/storage';
import usersJson from '@/mock/users.json';

interface AuthState {
  user: User | null;
  users: User[];
  login: (userId: string) => void;
  logout: () => void;
}

const USERS: User[] = usersJson as User[];
const CURRENT_KEY = 'current_user_id';

export const useAuthStore = create<AuthState>((set) => {
  const savedId = storage.get<string | null>(CURRENT_KEY, null);
  const initial = savedId ? USERS.find((u) => u.id === savedId) ?? null : null;
  return {
    user: initial,
    users: USERS,
    login: (userId: string) => {
      const user = USERS.find((u) => u.id === userId);
      if (!user) return;
      storage.set(CURRENT_KEY, user.id);
      set({ user });
    },
    logout: () => {
      storage.remove(CURRENT_KEY);
      set({ user: null });
    },
  };
});
