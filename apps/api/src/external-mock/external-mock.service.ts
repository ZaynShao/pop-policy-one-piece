import { Injectable } from '@nestjs/common';
import type { MockInvokeRequestDto, MockInvokeResponseDto } from '@pop/shared-types';

const PROVINCE_NAMES: Record<string, string> = {
  '110000': '北京',
  '120000': '天津',
  '310000': '上海',
  '500000': '重庆',
  '320000': '江苏',
  '330000': '浙江',
  '440000': '广东',
  '510000': '四川',
  '610000': '陕西',
  '370000': '山东',
  '420000': '湖北',
  '430000': '湖南',
  '410000': '河南',
};

const THEME_NAMES: Record<string, string> = {
  v2g: 'V2G',
  vpp: '虚拟电厂',
  charging: '充电基础设施',
  storage: '新型储能',
  electricity_market: '电力市场',
};

@Injectable()
export class ExternalMockService {
  invoke(req: MockInvokeRequestDto): MockInvokeResponseDto {
    const provinceName = PROVINCE_NAMES[req.regionCode] ?? '全国';
    const themeName = THEME_NAMES[req.themeCode ?? ''] ?? (req.themeCode ?? '通用');
    const ts = new Date().toISOString();
    return {
      downloadUrl: `/api/v1/external/mock/files/${req.regionCode}-${req.themeCode ?? 'general'}.pdf`,
      summary: `${provinceName} ${themeName} 定制谈参 v0.1 - 自动生成于 ${ts}`,
      params: { region: req.regionCode, theme: req.themeCode ?? 'general' },
      generatedAt: ts,
    };
  }
}
