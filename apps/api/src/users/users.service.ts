import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRoleCode } from '@pop/shared-types';
import { UserEntity } from './entities/user.entity';
import { UserRoleEntity } from './entities/user-role.entity';

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
