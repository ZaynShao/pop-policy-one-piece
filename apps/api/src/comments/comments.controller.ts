import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { type AuthenticatedUser } from '@pop/shared-types';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dtos/create-comment.dto';

/**
 * Comments API(β.2.5 留言板)
 * 全部走 sys_admin 全权(JWT auth + CASL `sys_admin manage all`)
 */
@Controller('pins/:pinId/comments')
export class CommentsController {
  constructor(private readonly service: CommentsService) {}

  @Get()
  async list(@Param('pinId') pinId: string) {
    const data = await this.service.listByPin(pinId);
    return { data };
  }

  @Post()
  async create(
    @Param('pinId') pinId: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.service.createManual(pinId, dto, user.id) };
  }
}
