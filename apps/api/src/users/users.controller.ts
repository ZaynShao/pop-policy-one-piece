import { Controller, Get } from '@nestjs/common';
import { UsersService } from './users.service';

/**
 * Users API — MVP 只暴露 list(属地大盘左面板「角色筛选」用)
 * V0.7+ 加 CRUD 时换 admin 守卫
 */
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  async list() {
    const data = await this.service.listAllWithRole();
    return { data };
  }
}
