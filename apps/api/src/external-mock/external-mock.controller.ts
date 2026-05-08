import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { ExternalMockService } from './external-mock.service';
import { Public } from '../common/decorators/public.decorator';
import type { MockInvokeRequestDto } from '@pop/shared-types';

@Controller('external/mock')
export class ExternalMockController {
  constructor(private readonly svc: ExternalMockService) {}

  @Public()
  @Post(':configKey')
  invoke(@Param('configKey') configKey: string, @Body() body: MockInvokeRequestDto) {
    return { data: this.svc.invoke({ ...body, configKey }) };
  }

  @Public()
  @Get('files/:filename')
  fakeFile(@Param('filename') filename: string, @Res() res: Response) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.send(Buffer.from(`%PDF-1.4\n% Mock external system fake file: ${filename}\n%%EOF\n`));
  }
}
