import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommentEntity } from './entities/comment.entity';
import { PinEntity } from '../pins/entities/pin.entity';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [TypeOrmModule.forFeature([CommentEntity, PinEntity])],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],  // visits.service 在 T6 要注入
})
export class CommentsModule {}
