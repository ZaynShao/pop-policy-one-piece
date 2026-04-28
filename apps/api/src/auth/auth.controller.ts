import { Body, Controller, Get, Post } from '@nestjs/common';
import type { AuthenticatedUser, LoginResponseDto } from '@pop/shared-types';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * POST /api/v1/auth/login
   * Body: { username }
   * 返回 JWT + user
   */
  @Public()
  @Post('login')
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.auth.login(dto.username, dto.password);
  }

  /**
   * GET /api/v1/auth/me
   * 需要 JWT;返回当前用户
   */
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }
}
