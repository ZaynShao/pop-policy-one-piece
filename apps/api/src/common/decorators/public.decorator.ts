import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * 标记路由不需要认证(跳过全局 JwtAuthGuard)。
 * 用在 /auth/login, /health 等入口。
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
