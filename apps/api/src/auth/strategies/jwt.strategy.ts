import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthenticatedUser, UserRoleCode } from '@pop/shared-types';
import { UsersService } from '../../users/users.service';

export interface JwtPayload {
  sub: string; // user.id
  username: string;
  role: UserRoleCode;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'change-me-in-production',
    });
  }

  /** passport 校验签名 + 过期后调用,返回值写入 req.user */
  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.users.findById(payload.sub);
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('用户不存在或已停用');
    }
    // 角色从 DB 现查,不信任 payload 里的 role(角色可能已变更)
    const roleCode = await this.users.getRoleCode(user.id);
    if (!roleCode) throw new UnauthorizedException('用户未分配角色');

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      roleCode,
    };
  }
}
