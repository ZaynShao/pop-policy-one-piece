import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommentEntity } from './entities/comment.entity';
import { PinEntity } from '../pins/entities/pin.entity';
import { CreateCommentDto } from './dtos/create-comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(CommentEntity)
    private readonly commentsRepo: Repository<CommentEntity>,
    @InjectRepository(PinEntity)
    private readonly pinsRepo: Repository<PinEntity>,
  ) {}

  async listByPin(pinId: string): Promise<CommentEntity[]> {
    const pin = await this.pinsRepo.findOne({ where: { id: pinId } });
    if (!pin) throw new NotFoundException(`Pin ${pinId} not found`);
    return this.commentsRepo.find({
      where: { parentPinId: pinId },
      order: { createdAt: 'DESC' },
      relations: ['creator'],
    });
  }

  async createManual(
    pinId: string,
    dto: CreateCommentDto,
    createdBy: string,
  ): Promise<CommentEntity> {
    const pin = await this.pinsRepo.findOne({ where: { id: pinId } });
    if (!pin) throw new NotFoundException(`Pin ${pinId} not found`);

    const comment = this.commentsRepo.create({
      parentPinId: pinId,
      sourceType: 'manual',
      body: dto.body,
      linkedVisitId: null,
      createdBy,
    });
    return this.commentsRepo.save(comment);
  }
}
