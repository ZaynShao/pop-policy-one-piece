import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { type AuthenticatedUser } from '@pop/shared-types';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { ChangePasswordDto } from './dtos/change-password.dto';
import { CreateUserDto } from './dtos/create-user.dto';
import { UpdateUserDto } from './dtos/update-user.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';
import { ChangeRoleDto } from './dtos/change-role.dto';
import { UserEntity } from './entities/user.entity';

/**
 * Users API — list(角色筛选用)+ self profile(改昵称 / 改密码)
 * Admin CRUD 待 T4 加
 */
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  async list() {
    const data = await this.service.listAllWithRole();
    return { data };
  }

  /** 改自己昵称 — 头像下拉「修改资料」 */
  @Put('me')
  async updateMe(
    @Body() dto: UpdateProfileDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.service.updateProfile(user.id, dto);
    return {
      data: {
        id: data.id,
        username: data.username,
        displayName: data.displayName,
        email: data.email,
      },
    };
  }

  /** 改自己密码 — 头像下拉「修改资料」/ 旧密码必填 */
  @Put('me/password')
  @HttpCode(204)
  async changeMyPassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.service.changePassword(user.id, dto);
  }

  @Post()
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.service.create(dto, user);
    return { data: this.stripPasswordHash(data) };
  }

  @Put(':id')
  async updateById(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.service.updateById(id, dto, user);
    return { data: this.stripPasswordHash(data) };
  }

  @Put(':id/password')
  @HttpCode(204)
  async resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.service.resetPassword(id, dto.newPassword, user);
  }

  @Put(':id/role')
  async changeRole(
    @Param('id') id: string,
    @Body() dto: ChangeRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const role = await this.service.changeRole(id, dto.roleCode, user);
    return { data: { id, roleCode: role } };
  }

  @Delete(':id')
  @HttpCode(204)
  async softDelete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.service.softDeleteUser(id, user);
  }

  @Post(':id/restore')
  async restore(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const data = await this.service.restoreUser(id, user);
    return { data: this.stripPasswordHash(data) };
  }

  private stripPasswordHash(u: UserEntity): Omit<UserEntity, 'passwordHash'> {
    const { passwordHash: _drop, ...rest } = u;
    void _drop;
    return rest as Omit<UserEntity, 'passwordHash'>;
  }
}
