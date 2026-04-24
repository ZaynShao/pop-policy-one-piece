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
