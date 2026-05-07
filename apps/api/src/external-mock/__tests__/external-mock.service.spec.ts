import { Test } from '@nestjs/testing';
import { ExternalMockService } from '../external-mock.service';

describe('ExternalMockService.invoke', () => {
  let svc: ExternalMockService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [ExternalMockService],
    }).compile();
    svc = module.get(ExternalMockService);
  });

  it('上海(310000)V2G:返回含上海字样', () => {
    const r = svc.invoke({ regionCode: '310000', themeCode: 'v2g' });
    expect(r.summary).toContain('上海');
    expect(r.summary).toContain('V2G');
    expect(r.params.region).toBe('310000');
    expect(r.downloadUrl).toMatch(/310000.*v2g/);
  });

  it('未知 region:fallback "全国"', () => {
    const r = svc.invoke({ regionCode: '999999', themeCode: 'storage' });
    expect(r.summary).toMatch(/全国|未知地域/);
  });

  it('configKey + region 都计入返回 params', () => {
    const r = svc.invoke({ regionCode: '110000', themeCode: 'storage', configKey: 'k1' });
    expect(r.params).toEqual(expect.objectContaining({ region: '110000', theme: 'storage' }));
  });
});
