import { Test } from '@nestjs/testing';
import { OssService } from '../oss.service';

describe('OssService.generateUploadUrl', () => {
  let svc: OssService;

  beforeEach(async () => {
    process.env.OSS_REGION = 'oss-cn-hongkong';
    process.env.OSS_BUCKET = 'pop-test';
    process.env.OSS_ACCESS_KEY_ID = 'test-ak';
    process.env.OSS_ACCESS_KEY_SECRET = 'test-sk';
    const module = await Test.createTestingModule({ providers: [OssService] }).compile();
    svc = module.get(OssService);
  });

  it('返回 PUT URL + objectKey + publicUrl', () => {
    const r = svc.generateUploadUrl('test.pdf', 'application/pdf');
    expect(r.objectKey).toMatch(/^tools\/.+test\.pdf$/);
    expect(r.uploadUrl).toContain('oss-cn-hongkong');
    expect(r.uploadUrl).toContain('Signature=');
    expect(r.publicUrl).toBe(`https://pop-test.oss-cn-hongkong.aliyuncs.com/${r.objectKey}`);
  });
});
