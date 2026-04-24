import axios from 'axios';
import { useAuthStore } from '@/stores/auth';

/**
 * POP HTTP 客户端(axios 实例)
 * - 自动附 Authorization: Bearer <token>
 * - 401 时清登录态(前端路由守卫会把用户踢回 /login)
 */
export const http = axios.create({
  baseURL: '/api/v1',
  timeout: 15_000,
});

http.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);
