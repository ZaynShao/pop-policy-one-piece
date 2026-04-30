import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VoiceService } from './voice.service';
import type {
  VoiceParseVisitContext,
  VoiceParseVisitResponse,
} from '@pop/shared-types';

const MAX_AUDIO_BYTES = 1024 * 1024; // 1 MB(60 秒 webm/opus 约 500 KB,留 2x 缓冲)

@Controller('voice')
export class VoiceController {
  constructor(private readonly service: VoiceService) {}

  @Post('parse-visit')
  @UseInterceptors(
    FileInterceptor('audio', {
      limits: { fileSize: MAX_AUDIO_BYTES },
    }),
  )
  async parseVisit(
    @UploadedFile() audio: Express.Multer.File | undefined,
    @Body('context') contextJson: string | undefined,
  ): Promise<VoiceParseVisitResponse> {
    if (!audio) throw new BadRequestException('audio 字段缺失');
    if (audio.size === 0) {
      throw new BadRequestException('audio 内容为空');
    }
    if (!contextJson) throw new BadRequestException('context 字段缺失');

    let ctx: VoiceParseVisitContext;
    try {
      ctx = JSON.parse(contextJson);
    } catch {
      throw new BadRequestException('context 必须是合法 JSON 字符串');
    }
    if (!ctx.today || !/^\d{4}-\d{2}-\d{2}$/.test(ctx.today)) {
      throw new BadRequestException('context.today 必须为 YYYY-MM-DD 格式');
    }

    return this.service.parseVisit(audio.buffer, audio.mimetype, ctx);
  }
}
