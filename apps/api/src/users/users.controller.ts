import { Body, Controller, Get, HttpCode, Put } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { type AuthenticatedUser } from '@pop/shared-types';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import { ChangePasswordDto } from './dtos/change-password.dto';

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
}
