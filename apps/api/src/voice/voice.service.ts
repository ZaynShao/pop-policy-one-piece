import { Injectable, Logger } from '@nestjs/common';
import type { VoiceParseVisitContext, VoiceParseVisitResponse } from '@pop/shared-types';

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  async parseVisit(
    _audio: Buffer,
    _mimeType: string,
    _ctx: VoiceParseVisitContext,
  ): Promise<VoiceParseVisitResponse> {
    // Task 3 替换为真实实现
    return {
      transcript: '(stub) 这是 stub 实现,Task 3 接 MiniMax',
      parsed: {
        visitDate: _ctx.today,
        provinceCode: null,
        cityName: null,
        department: null,
        contactPerson: null,
        contactTitle: null,
        outcomeSummary: null,
        color: null,
        followUp: null,
      },
    };
  }
}
