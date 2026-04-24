import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthenticatedUser } from '@pop/shared-types';

interface AuthState {
  accessToken: string | null;
  expiresAt: number | null;
  user: AuthenticatedUser | null;
  setSession: (
    accessToken: string,
    expiresAt: number,
    user: AuthenticatedUser,
  ) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      expiresAt: null,
      user: null,
      setSession: (accessToken, expiresAt, user) =>
        set({ accessToken, expiresAt, user }),
      logout: () => set({ accessToken: null, expiresAt: null, user: null }),
      isAuthenticated: () => {
        const { accessToken, expiresAt } = get();
        if (!accessToken) return false;
        // 本地也检查一下 exp(JWT 本身服务器会查,这只是提前踢出)
        if (expiresAt && expiresAt * 1000 < Date.now()) return false;
        return true;
      },
    }),
    {
      name: 'pop-auth',
      storage: createJSONStorage(() => localStorage),
      // 只持久化必要字段(避免 rehydration 跑方法)
      partialize: (s) => ({
        accessToken: s.accessToken,
        expiresAt: s.expiresAt,
        user: s.user,
      }),
    },
  ),
);
