import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '@pop/shared-types';

/**
 * 从请求上拿已认证用户(JwtStrategy.validate 写入)。
 *
 * 用法:
 *   ```ts
 *   @Get('me')
 *   me(@CurrentUser() user: AuthenticatedUser) { return user; }
 *   ```
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
    }>();
    if (!request.user) {
      throw new Error(
        'CurrentUser 装饰器在未认证路由使用 —— 请检查是否漏配 JwtAuthGuard',
      );
    }
    return request.user;
  },
);
