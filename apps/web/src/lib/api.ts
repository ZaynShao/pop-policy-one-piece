import { useAuthStore } from '@/stores/auth';

/**
 * 同步读 zustand auth store 的 accessToken(token 存在 localStorage 'pop-auth' key 下)。
 * fetch 函数定义在组件外(非 hook 上下文),用 useAuthStore.getState() 而非 hook。
 */
export function getAuthToken(): string | null {
  return useAuthStore.getState().accessToken;
}

export function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
