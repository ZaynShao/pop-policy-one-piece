import * as bcrypt from 'bcrypt';
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
   * 登录(PRD §8.1 bcrypt 校验):
   * - 按 username 精确匹配,status 必须 active
   * - 找不到或密码错误均返回统一文案(防枚举)
   * - passwordHash 为 NULL 表示用户未启用,返回引导文案
   * - 单 token,无 refresh(V0.5 接真 OIDC 时换)
   */
  async login(username: string, password: string): Promise<LoginResponseDto> {
    const user = await this.users.findByUsername(username);
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('用户名或密码错误');
    }
    if (!user.passwordHash) {
      throw new UnauthorizedException('用户未启用,请联系管理员');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    const roleCode = await this.users.getRoleCode(user.id);
    if (!roleCode) {
      throw new UnauthorizedException('用户未分配角色,请联系管理员');
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
