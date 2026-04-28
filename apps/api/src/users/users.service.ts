import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserRoleCode, type AuthenticatedUser } from '@pop/shared-types';
import { UserEntity } from './entities/user.entity';
import { UserRoleEntity } from './entities/user-role.entity';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { ChangePasswordDto } from './dtos/change-password.dto';
import { CreateUserDto } from './dtos/create-user.dto';
import { UpdateUserDto } from './dtos/update-user.dto';

const USERS_ADMIN_ALLOWED_ROLES: ReadonlySet<UserRoleCode> = new Set([
  UserRoleCode.SysAdmin,
]);

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

  private assertAdmin(currentUser: AuthenticatedUser): void {
    if (!USERS_ADMIN_ALLOWED_ROLES.has(currentUser.roleCode)) {
      throw new ForbiddenException('需要管理员权限');
    }
  }

  async create(dto: CreateUserDto, currentUser: AuthenticatedUser): Promise<UserEntity> {
    this.assertAdmin(currentUser);
    const exists = await this.users.findOne({
      where: [{ username: dto.username }, { email: dto.email }],
      withDeleted: true,
    });
    if (exists) throw new BadRequestException('用户名或邮箱已存在');
    const user = this.users.create({
      username: dto.username,
      displayName: dto.displayName,
      email: dto.email,
      passwordHash: await bcrypt.hash(dto.password, 10),
      status: 'active' as never,
      createdBy: currentUser.id,
    });
    const saved = await this.users.save(user);
    await this.userRoles.save({
      userId: saved.id,
      roleCode: dto.roleCode,
      assignedBy: currentUser.id,
    });
    return saved;
  }

  async updateById(id: string, dto: UpdateUserDto, currentUser: AuthenticatedUser): Promise<UserEntity> {
    this.assertAdmin(currentUser);
    const user = await this.findById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    if (dto.email && dto.email !== user.email) {
      const conflict = await this.users.findOne({ where: { email: dto.email }, withDeleted: true });
      if (conflict) throw new BadRequestException('邮箱已存在');
      user.email = dto.email;
    }
    if (dto.displayName !== undefined) user.displayName = dto.displayName;
    return this.users.save(user);
  }

  async resetPassword(id: string, newPassword: string, currentUser: AuthenticatedUser): Promise<void> {
    this.assertAdmin(currentUser);
    const user = await this.findById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.users.save(user);
  }

  async changeRole(id: string, roleCode: UserRoleCode, currentUser: AuthenticatedUser): Promise<UserRoleCode> {
    this.assertAdmin(currentUser);
    const user = await this.findById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    // user_roles 表 unique(userId),改 role 走 DELETE+INSERT
    await this.userRoles.delete({ userId: id });
    await this.userRoles.save({
      userId: id,
      roleCode,
      assignedBy: currentUser.id,
    });
    return roleCode;
  }

  async softDeleteUser(id: string, currentUser: AuthenticatedUser): Promise<void> {
    this.assertAdmin(currentUser);
    if (id === currentUser.id) {
      throw new BadRequestException('不能删除自己');
    }
    const user = await this.findById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    // 检查目标是否唯一 sys_admin(防误删自锁)
    const targetRole = await this.userRoles.findOne({ where: { userId: id } });
    if (targetRole?.roleCode === UserRoleCode.SysAdmin) {
      const adminCount = await this.userRoles.count({
        where: { roleCode: UserRoleCode.SysAdmin },
      });
      if (adminCount <= 1) {
        throw new BadRequestException('不能删除唯一管理员');
      }
    }
    await this.users.softRemove(user);
  }

  async restoreUser(id: string, currentUser: AuthenticatedUser): Promise<UserEntity> {
    this.assertAdmin(currentUser);
    await this.users.restore(id);
    return this.users.findOneOrFail({ where: { id } });
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
