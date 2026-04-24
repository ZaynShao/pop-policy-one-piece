import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AuthenticatedUser, LoginResponseDto } from '@pop/shared-types';
import { UsersService } from '../users/users.service';
import type { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Fake SSO 登录(MVP fallback,PRD §8.1):
   * - 无密码,按 username 精确匹配
   * - status 必须 active
   * - 单 token,无 refresh(V0.5 接真 OIDC 时换)
   */
  async login(username: string): Promise<LoginResponseDto> {
    const user = await this.users.findByUsername(username);
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException(`用户 ${username} 不存在或已停用`);
    }
    const roleCode = await this.users.getRoleCode(user.id);
    if (!roleCode) {
      throw new UnauthorizedException(`用户 ${username} 未分配角色`);
    }

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: roleCode,
    };

    const expiresIn = this.config.get<string>('JWT_EXPIRES_IN') ?? '7d';
    const accessToken = this.jwt.sign(payload, { expiresIn });
    const decoded = this.jwt.decode(accessToken) as { exp?: number };

    const authUser: AuthenticatedUser = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      roleCode,
    };

    return {
      accessToken,
      expiresAt: decoded.exp ?? 0,
      user: authUser,
    };
  }
}
