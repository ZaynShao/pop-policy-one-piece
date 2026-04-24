import type { UserRoleCode } from '../enums/role';

/**
 * 登录请求(PRD §8.1 MVP fallback:无密码假 SSO)
 *
 * V0.5 换真 OIDC 后,本 DTO 废弃,改走 /auth/callback?code=xxx。
 */
export interface LoginRequestDto {
  username: string;
}

/**
 * 认证后的当前用户(前端 /auth/me 返回 + JWT payload 扩展字段)
 */
export interface AuthenticatedUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  roleCode: UserRoleCode;
}

export interface LoginResponseDto {
  accessToken: string;
  /** JWT 过期时间(秒,epoch;前端可用于自动登出判断) */
  expiresAt: number;
  user: AuthenticatedUser;
}
