import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserRoleCode } from '@pop/shared-types';
import { UserEntity } from './entities/user.entity';
import { UserRoleEntity } from './entities/user-role.entity';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { ChangePasswordDto } from './dtos/change-password.dto';

export interface UserWithRole {
  user: UserEntity;
  roleCode: UserRoleCode;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    @InjectRepository(UserRoleEntity)
    private readonly userRoles: Repository<UserRoleEntity>,
  ) {}

  async findByUsername(username: string): Promise<UserEntity | null> {
    return this.users.findOne({ where: { username } });
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.users.findOne({ where: { id } });
  }

  async getRoleCode(userId: string): Promise<UserRoleCode | null> {
    const r = await this.userRoles.findOne({ where: { userId } });
    return r?.roleCode ?? null;
  }

  /**
   * 列出所有 active 用户 + role(属地大盘左面板「角色筛选」用)
   * 不返回 disabled / pending / soft-deleted 用户
   */
  async listAllWithRole(): Promise<Array<{
    id: string;
    username: string;
    displayName: string;
    roleCode: UserRoleCode | null;
  }>> {
    const users = await this.users.find({
      where: { status: 'active' as never },
      order: { username: 'ASC' },
    });
    const roles = await this.userRoles.find({
      where: users.map((u) => ({ userId: u.id })),
    });
    const roleMap = new Map(roles.map((r) => [r.userId, r.roleCode]));
    return users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      roleCode: roleMap.get(u.id) ?? null,
    }));
  }

  /** 改自己的 displayName(头像下拉「修改资料」用) */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserEntity> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    user.displayName = dto.displayName;
    return this.users.save(user);
  }

  /** 改自己的密码:必须输旧密码校验 */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    if (!user.passwordHash) {
      throw new UnauthorizedException('账号未设密码,请联系管理员');
    }
    const ok = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('旧密码错误');
    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.users.save(user);
  }

  /** 合并 user + role;常用于 AuthService 和 JwtStrategy */
  async loadWithRole(userId: string): Promise<UserWithRole> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    const roleCode = await this.getRoleCode(userId);
    if (!roleCode) {
      throw new NotFoundException(
        `User ${userId} has no role assigned (MVP 严格单角色,请检查 seed)`,
      );
    }
    return { user, roleCode };
  }
}
