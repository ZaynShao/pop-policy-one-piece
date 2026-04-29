# R2.7 移动端语音输入 + LLM 解析 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移动端 `/m/visit/new` 页面顶部加红色「语音录入」按钮,用户口述 → MiniMax-M2.7-highspeed 多模态 LLM 一次性解析音频 + 输出 JSON,前端 setFieldsValue 自动填充表单 7 个字段。

**Architecture:** 后端中转架构 — 浏览器录 webm/opus → POST 多 part 表单到 NestJS → service 把 audio base64 + 系统提示词组装成 chat completions 请求 → MiniMax 原生多模态返回 JSON → 后端校验后透传给前端 → 前端 filter null 字段后 setFieldsValue + 必填字段缺失时顶部黄色横幅提示。

**Tech Stack:** NestJS 10 + axios + @nestjs/platform-express(Multer) / React 18 + antd 5 + MediaRecorder Web API / MiniMax chat completions(OpenAI 兼容)

---

## 实施前置

参考 spec:`docs/superpowers/specs/2026-04-29-r27-mobile-voice-input-design.md`

服务器已有部署:
- 前端 `/opt/pop/apps/web/dist`(R2.6 GPS 禁用版)
- 后端 pm2 跑 NestJS 在 :3001
- Caddy 反代 /api → :3001

需要在服务器 `/opt/pop/.env` 加 2 个环境变量(Task 8 做):
```
MINIMAX_API_KEY=sk-cp-...(用户提供)
MINIMAX_BASE_URL=https://api.minimaxi.com/v1
```

---

## Task 1: Shared Types

**Files:**
- Create: `packages/shared-types/src/dtos/voice.ts`
- Modify: `packages/shared-types/src/index.ts`

- [ ] **Step 1: 创建 voice DTO 文件**

文件内容 `packages/shared-types/src/dtos/voice.ts`:

```ts
/** 前端调 voice/parse-visit 时附带的上下文 */
export interface VoiceParseVisitContext {
  /** YYYY-MM-DD,前端取浏览器今天的日期 */
  today: string;
  /** 用户当前在下拉框选的省级 code,可空 */
  currentProvinceCode?: string | null;
  /** 用户当前在下拉框选的市/区名,可空 */
  currentCityName?: string | null;
}

/** LLM 解析后的字段,任意字段为 null 表示模型未识别 */
export interface VoiceParsedFields {
  visitDate: string | null;
  provinceCode: string | null;
  cityName: string | null;
  department: string | null;
  contactPerson: string | null;
  contactTitle: string | null;
  outcomeSummary: string | null;
  color: 'red' | 'yellow' | 'green' | null;
  followUp: boolean | null;
}

/** POST /api/v1/voice/parse-visit 响应 */
export interface VoiceParseVisitResponse {
  /** 原始转写,前端做日志/调试用 */
  transcript: string;
  parsed: VoiceParsedFields;
}
```

- [ ] **Step 2: 在 index.ts 导出 voice 类型**

修改 `packages/shared-types/src/index.ts`,在文件末尾追加一行(若文件末尾已有 dtos 导出则在该 block 内追加):

```ts
export * from './dtos/voice';
```

- [ ] **Step 3: typecheck**

Run: `npm run typecheck --workspace=@pop/shared-types`
Expected: 无错误,静默成功

- [ ] **Step 4: build:shared(让消费者能解析)**

Run: `npm run build:shared`
Expected: 看到 `tsc` 输出,`packages/shared-types/dist/dtos/voice.js` + `voice.d.ts` 文件生成

- [ ] **Step 5: 验证产物**

Run: `ls packages/shared-types/dist/dtos/voice.*`
Expected:
```
packages/shared-types/dist/dtos/voice.d.ts
packages/shared-types/dist/dtos/voice.js
```

- [ ] **Step 6: Commit**

```bash
git add packages/shared-types/src/dtos/voice.ts packages/shared-types/src/index.ts
git commit -m "feat(shared-types): add voice parse-visit types"
```

---

## Task 2: 后端 Voice 模块骨架(controller + service stub + 注册)

**Files:**
- Create: `apps/api/src/voice/voice.module.ts`
- Create: `apps/api/src/voice/voice.controller.ts`
- Create: `apps/api/src/voice/voice.service.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: 看 app.module.ts 当前 imports 列表**

Run: `grep -A 30 "imports:" apps/api/src/app.module.ts | head -35`
Expected: 看到现有 imports 包含 `AuthModule`、`VisitsModule`、`PinsModule` 等,沿用同样模式

- [ ] **Step 2: 看 visits.controller.ts 学守卫和路由模式**

Run: `head -30 apps/api/src/visits/visits.controller.ts`
Expected: 看到 `@Controller('visits')` + `@UseGuards(JwtAuthGuard)` 的写法,后续 voice.controller 沿用

- [ ] **Step 3: 创建 voice.service.ts(stub,先写最小实现让 controller 能编译)**

文件内容 `apps/api/src/voice/voice.service.ts`:

```ts
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
```

- [ ] **Step 4: 创建 voice.controller.ts**

文件内容 `apps/api/src/voice/voice.controller.ts`:

```ts
import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VoiceService } from './voice.service';
import type {
  VoiceParseVisitContext,
  VoiceParseVisitResponse,
} from '@pop/shared-types';

const MAX_AUDIO_BYTES = 1024 * 1024; // 1 MB(60 秒 webm/opus 约 500 KB,留 2x 缓冲)

@Controller('voice')
@UseGuards(JwtAuthGuard)
export class VoiceController {
  constructor(private readonly svc: VoiceService) {}

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
    if (!audio.buffer || audio.size === 0) {
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

    return this.svc.parseVisit(audio.buffer, audio.mimetype, ctx);
  }
}
```

- [ ] **Step 5: 创建 voice.module.ts**

文件内容 `apps/api/src/voice/voice.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { VoiceController } from './voice.controller';
import { VoiceService } from './voice.service';

@Module({
  controllers: [VoiceController],
  providers: [VoiceService],
})
export class VoiceModule {}
```

- [ ] **Step 6: 在 app.module.ts 注册 VoiceModule**

修改 `apps/api/src/app.module.ts`:

a) 在文件顶部 import 区追加一行:
```ts
import { VoiceModule } from './voice/voice.module';
```

b) 在 `imports: [...]` 数组末尾(其他 Module 之后、闭合 `]` 之前)追加:
```ts
    VoiceModule,
```

- [ ] **Step 7: typecheck**

Run: `npm run typecheck --workspace=@pop/api`
Expected: 无错误

- [ ] **Step 8: 启动 dev API,测 stub 端点**

Run(在第 1 个终端):`cd apps/api && npm run dev`
等 5 秒看到 `Nest application successfully started`,然后在第 2 个终端跑:

```bash
# 1. 拿 token
TOKEN=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"username":"sysadmin","password":"pop2026"}' \
  http://localhost:3001/api/v1/auth/login | node -e "console.log(require('fs').readFileSync(0,'utf8') | jq -r .accessToken" 2>/dev/null || \
  curl -s -X POST -H "Content-Type: application/json" \
  -d '{"username":"sysadmin","password":"pop2026"}' \
  http://localhost:3001/api/v1/auth/login)
echo "$TOKEN" | head -c 100

# 提取 accessToken (jq 没装就用 sed)
ACCESS=$(echo "$TOKEN" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
echo "got: ${ACCESS:0:30}..."

# 2. 测 stub 端点(用 echo 假 audio)
echo -n "fakeaudio" > /tmp/fake.webm
curl -s -X POST http://localhost:3001/api/v1/voice/parse-visit \
  -H "Authorization: Bearer $ACCESS" \
  -F "audio=@/tmp/fake.webm;type=audio/webm" \
  -F 'context={"today":"2026-04-29","currentProvinceCode":"310000","currentCityName":"浦东新区"}'
```

Expected: 返回 200 + JSON `{"transcript":"(stub) 这是 stub 实现...","parsed":{...,"visitDate":"2026-04-29",...}}`

- [ ] **Step 9: 测错误路径**

```bash
# 不带 context
curl -s -o /tmp/r.json -w "HTTP %{http_code}\n" -X POST http://localhost:3001/api/v1/voice/parse-visit \
  -H "Authorization: Bearer $ACCESS" \
  -F "audio=@/tmp/fake.webm;type=audio/webm"
cat /tmp/r.json
```
Expected: HTTP 400 + `"context 字段缺失"`

```bash
# context 不是合法 JSON
curl -s -o /tmp/r.json -w "HTTP %{http_code}\n" -X POST http://localhost:3001/api/v1/voice/parse-visit \
  -H "Authorization: Bearer $ACCESS" \
  -F "audio=@/tmp/fake.webm;type=audio/webm" \
  -F "context=not-json"
cat /tmp/r.json
```
Expected: HTTP 400 + `"context 必须是合法 JSON 字符串"`

```bash
# today 格式错
curl -s -o /tmp/r.json -w "HTTP %{http_code}\n" -X POST http://localhost:3001/api/v1/voice/parse-visit \
  -H "Authorization: Bearer $ACCESS" \
  -F "audio=@/tmp/fake.webm;type=audio/webm" \
  -F 'context={"today":"4/29/2026"}'
cat /tmp/r.json
```
Expected: HTTP 400 + `"context.today 必须为 YYYY-MM-DD 格式"`

```bash
# 没 token
curl -s -o /tmp/r.json -w "HTTP %{http_code}\n" -X POST http://localhost:3001/api/v1/voice/parse-visit \
  -F "audio=@/tmp/fake.webm;type=audio/webm" \
  -F 'context={"today":"2026-04-29"}'
```
Expected: HTTP 401

- [ ] **Step 10: 停 dev API**

回到第 1 个终端按 `Ctrl+C` 停止 `npm run dev`

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/voice/ apps/api/src/app.module.ts
git commit -m "feat(api/voice): scaffold voice module with stub controller"
```

---

## Task 3: 后端 Prompt + MiniMax 集成

**Files:**
- Create: `apps/api/src/voice/prompt.ts`
- Modify: `apps/api/src/voice/voice.service.ts`

- [ ] **Step 1: 创建 prompt.ts**

文件内容 `apps/api/src/voice/prompt.ts`:

```ts
import type { VoiceParseVisitContext } from '@pop/shared-types';

const PROVINCE_TABLE = `北京市=110000、天津市=120000、河北省=130000、山西省=140000、内蒙古自治区=150000、辽宁省=210000、吉林省=220000、黑龙江省=230000、上海市=310000、江苏省=320000、浙江省=330000、安徽省=340000、福建省=350000、江西省=360000、山东省=370000、河南省=410000、湖北省=420000、湖南省=430000、广东省=440000、广西壮族自治区=450000、海南省=460000、重庆市=500000、四川省=510000、贵州省=520000、云南省=530000、西藏自治区=540000、陕西省=610000、甘肃省=620000、青海省=630000、宁夏回族自治区=640000、新疆维吾尔自治区=650000、香港特别行政区=810000、澳门特别行政区=820000、台湾省=710000`;

/** 把 context 渲染成 system prompt */
export function buildVoicePrompt(ctx: VoiceParseVisitContext): string {
  const provinceCode = ctx.currentProvinceCode ?? '';
  const cityName = ctx.currentCityName ?? '';
  const provinceLabel = provinceCode ? `${provinceCode}` : '未选';
  const cityLabel = cityName || '未选';

  return `你是政策拜访记录辅助 AI。任务:把用户的语音转写为结构化字段,用于自动填写"已完成拜访"录入表单。

【输入】
- 音频:用户口述的本次拜访经过(普通话,可能含方言口音)
- 当前日期:${ctx.today}
- 用户已选省市:${provinceLabel} / ${cityLabel}
- 中国省份代码表:
  ${PROVINCE_TABLE}

【输出】严格 JSON,不要任何 markdown / 解释文字 / 多余空白:

{
  "transcript": "<原始口述全文,用于用户复核>",
  "visitDate": "YYYY-MM-DD" | null,
  "provinceCode": "6 位省级代码" | null,
  "cityName": "市/区名" | null,
  "department": "对接的部门/单位全称" | null,
  "contactPerson": "对接人姓名" | null,
  "contactTitle": "对接人职务" | null,
  "outcomeSummary": "一句话总结产出" | null,
  "color": "red" | "yellow" | "green" | null,
  "followUp": true | false | null
}

【字段填充规则】

1. transcript:必填,保持原话(含口语词、停顿词),便于用户复核

2. visitDate:用户说"今天/昨天/上周三/4 月 28 号"等表述 → 解析为 YYYY-MM-DD;没说时间 → null(前端会用今天默认)

3. provinceCode + cityName(强弱标签规则):
   - 用户明确说省/直辖市名 → 填对应 code 和市名
   - 用户说强地理标签(浦东、海淀、天河、福田、雁塔、武侯、天府、南山、滨海、朝阳[北京]、徐汇、长宁 等明确指向单一省市的著名区) → 推断填省市
   - 用户说弱地理标签(东城区、西城区、新区、开发区、高新区、城南区等多个城市都有的) → 不要推断,返回 null
   - 用户只说部门名("发改委"/"某局"/"产业园") → 不要推断,返回 null
   - 没说任何地理信息 → null(前端会用用户已选)

4. department:对接部门全称,用户没说 → null(不要瞎编)

5. contactPerson:对接人姓名,用户没说 → null

6. contactTitle:职务(处长/主任/局长 等),用户没说 → null

7. outcomeSummary:一句话总结产出,用户没说事项 → null

8. color:
   - 紧急/危急/必须立即/争分夺秒 → "red"
   - 上级关注/层级提升/重要/优先 → "yellow"
   - 其他/常规走访/例行 → "green"
   - 完全无线索 → null(前端用 green 默认)

9. followUp:
   - 用户说"需要继续/后续跟进/再约/回头联系" → true
   - 用户明确说"不需要后续/事情结了/无需跟进" → false
   - 没说 → null(前端用 false 默认)

【约束】
- 只输出 JSON,首字符必须是 \`{\`,末字符必须是 \`}\`,前后无任何文本
- 不要给字段加注释、不要 markdown、不要解释
- 用户语义模糊时选最合理解释;不确定就 null,不瞎编
- 转写文本 transcript 保持原话(含口语词、停顿词)

【示例 1】
用户语音:"今天上午我去上海发改委拜访张处长,谈了半导体补贴政策,他答应下周协调绿色通道,这事比较紧急,需要后续跟进"
输出:
{"transcript":"今天上午我去上海发改委拜访张处长,谈了半导体补贴政策,他答应下周协调绿色通道,这事比较紧急,需要后续跟进","visitDate":"${ctx.today}","provinceCode":"310000","cityName":"上海市","department":"上海发改委","contactPerson":"张处长","contactTitle":"处长","outcomeSummary":"谈了半导体补贴政策,下周协调绿色通道","color":"red","followUp":true}

【示例 2】
用户语音:"今天去发改委了"
输出:
{"transcript":"今天去发改委了","visitDate":"${ctx.today}","provinceCode":null,"cityName":null,"department":"发改委","contactPerson":null,"contactTitle":null,"outcomeSummary":null,"color":null,"followUp":null}`;
}
```

- [ ] **Step 2: 替换 voice.service.ts 为真实实现**

完整覆盖 `apps/api/src/voice/voice.service.ts`:

```ts
import {
  BadGatewayException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  RequestTimeoutException,
} from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import type {
  VoiceParseVisitContext,
  VoiceParseVisitResponse,
  VoiceParsedFields,
} from '@pop/shared-types';
import { buildVoicePrompt } from './prompt';

const TIMEOUT_MS = 15_000;
const VALID_COLORS = ['red', 'yellow', 'green'] as const;

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);
  private readonly apiKey = process.env.MINIMAX_API_KEY ?? '';
  private readonly baseUrl =
    process.env.MINIMAX_BASE_URL ?? 'https://api.minimaxi.com/v1';
  private readonly model = 'MiniMax-M2.7-highspeed';

  async parseVisit(
    audio: Buffer,
    mimeType: string,
    ctx: VoiceParseVisitContext,
  ): Promise<VoiceParseVisitResponse> {
    if (!this.apiKey) {
      this.logger.error('MINIMAX_API_KEY not configured');
      throw new InternalServerErrorException('AI 服务未配置');
    }

    const audioBase64 = audio.toString('base64');
    const format = mimeType.includes('webm')
      ? 'webm'
      : mimeType.includes('wav')
        ? 'wav'
        : 'webm';
    const prompt = buildVoicePrompt(ctx);

    let resp;
    try {
      resp = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'input_audio',
                  input_audio: { data: audioBase64, format },
                },
              ],
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: TIMEOUT_MS,
        },
      );
    } catch (e) {
      const ae = e as AxiosError;
      if (ae.code === 'ECONNABORTED' || ae.message?.includes('timeout')) {
        this.logger.warn(`MiniMax timeout after ${TIMEOUT_MS}ms`);
        throw new RequestTimeoutException('AI 解析超时');
      }
      this.logger.error(
        `MiniMax fetch failed: ${ae.message} status=${ae.response?.status}`,
      );
      throw new BadGatewayException('AI 服务不可用');
    }

    const content: string = resp.data?.choices?.[0]?.message?.content ?? '';
    if (!content) {
      this.logger.error(
        `MiniMax returned empty content. raw: ${JSON.stringify(resp.data).slice(0, 500)}`,
      );
      throw new BadGatewayException('AI 返回空内容');
    }

    // 模型可能在 JSON 前后带 <think>...</think> 或其他文字,提取第一个 { 到最后一个 }
    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
      this.logger.error(`MiniMax returned non-JSON: ${content.slice(0, 500)}`);
      throw new BadGatewayException('AI 返回格式错误');
    }
    const jsonStr = content.slice(firstBrace, lastBrace + 1);

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      this.logger.error(
        `JSON.parse failed: ${(e as Error).message}, raw: ${jsonStr.slice(0, 500)}`,
      );
      throw new BadGatewayException('AI 返回格式错误');
    }

    const transcript =
      typeof parsed.transcript === 'string' ? parsed.transcript : '';
    if (!transcript || transcript.trim().length < 2) {
      this.logger.warn(
        `MiniMax returned empty/too-short transcript: "${transcript}"`,
      );
      throw new BadGatewayException('没有识别到内容,请重录');
    }

    const fields: VoiceParsedFields = {
      visitDate: this.cleanString(parsed.visitDate),
      provinceCode: this.cleanString(parsed.provinceCode),
      cityName: this.cleanString(parsed.cityName),
      department: this.cleanString(parsed.department),
      contactPerson: this.cleanString(parsed.contactPerson),
      contactTitle: this.cleanString(parsed.contactTitle),
      outcomeSummary: this.cleanString(parsed.outcomeSummary),
      color: this.cleanColor(parsed.color),
      followUp: typeof parsed.followUp === 'boolean' ? parsed.followUp : null,
    };

    return { transcript, parsed: fields };
  }

  /** 清洗:string + 非空 + trim,否则 null */
  private cleanString(v: unknown): string | null {
    if (typeof v !== 'string') return null;
    const t = v.trim();
    return t === '' ? null : t;
  }

  /** 颜色白名单,否则 null */
  private cleanColor(v: unknown): 'red' | 'yellow' | 'green' | null {
    if (typeof v !== 'string') return null;
    return (VALID_COLORS as readonly string[]).includes(v)
      ? (v as 'red' | 'yellow' | 'green')
      : null;
  }
}
```

- [ ] **Step 3: typecheck**

Run: `npm run typecheck --workspace=@pop/api`
Expected: 无错误

- [ ] **Step 4: 在本地测真实 MiniMax 调用(可选,需有 key)**

如果你本地有 MiniMax key 想验证,在 `apps/api/.env` 或 shell export `MINIMAX_API_KEY=sk-cp-...`,然后:

```bash
cd apps/api && MINIMAX_API_KEY=sk-cp-xxx npm run dev
```

否则跳到 Step 5(部署到服务器再验证)。

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/voice/prompt.ts apps/api/src/voice/voice.service.ts
git commit -m "feat(api/voice): MiniMax M2.7 chat-completions integration with prompt"
```

---

## Task 4: 后端单测(prompt + service 关键逻辑)

**Files:**
- Create: `apps/api/src/voice/voice.service.spec.ts`

- [ ] **Step 1: 看现有 service spec 模式**

Run: `find apps/api/src -name "*.service.spec.ts" | head -3`
看其中一个文件:`head -40 apps/api/src/visits/visits.service.spec.ts`(若存在)
Expected: 沿用同样的 NestJS Testing module 模式

如果项目没有现成 service spec,直接走 Step 2 用通用 Jest 模式。

- [ ] **Step 2: 创建 voice.service.spec.ts**

文件内容 `apps/api/src/voice/voice.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import {
  BadGatewayException,
  RequestTimeoutException,
} from '@nestjs/common';
import axios from 'axios';
import { VoiceService } from './voice.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('VoiceService', () => {
  let service: VoiceService;
  const ctx = {
    today: '2026-04-29',
    currentProvinceCode: '310000',
    currentCityName: '浦东新区',
  };
  const audio = Buffer.from('fakeaudio');

  beforeEach(async () => {
    process.env.MINIMAX_API_KEY = 'sk-test';
    const module = await Test.createTestingModule({
      providers: [VoiceService],
    }).compile();
    service = module.get(VoiceService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.MINIMAX_API_KEY;
  });

  it('parses valid JSON response', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                transcript: '今天去上海发改委',
                visitDate: '2026-04-29',
                provinceCode: '310000',
                cityName: '上海市',
                department: '上海发改委',
                contactPerson: null,
                contactTitle: null,
                outcomeSummary: null,
                color: null,
                followUp: null,
              }),
            },
          },
        ],
      },
    });

    const result = await service.parseVisit(audio, 'audio/webm', ctx);
    expect(result.transcript).toBe('今天去上海发改委');
    expect(result.parsed.provinceCode).toBe('310000');
    expect(result.parsed.cityName).toBe('上海市');
    expect(result.parsed.contactPerson).toBeNull();
  });

  it('strips <think> wrapper and extracts JSON', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content:
                '<think>let me reason about this</think>\n{"transcript":"今天","visitDate":null,"provinceCode":null,"cityName":null,"department":null,"contactPerson":null,"contactTitle":null,"outcomeSummary":null,"color":null,"followUp":null}',
            },
          },
        ],
      },
    });

    const result = await service.parseVisit(audio, 'audio/webm', ctx);
    expect(result.transcript).toBe('今天');
  });

  it('rejects empty transcript', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                transcript: '',
                visitDate: null,
                provinceCode: null,
                cityName: null,
                department: null,
                contactPerson: null,
                contactTitle: null,
                outcomeSummary: null,
                color: null,
                followUp: null,
              }),
            },
          },
        ],
      },
    });

    await expect(
      service.parseVisit(audio, 'audio/webm', ctx),
    ).rejects.toThrow(BadGatewayException);
  });

  it('rejects non-JSON response', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: { choices: [{ message: { content: 'I cannot do this' } }] },
    });

    await expect(
      service.parseVisit(audio, 'audio/webm', ctx),
    ).rejects.toThrow(BadGatewayException);
  });

  it('throws RequestTimeoutException on axios ECONNABORTED', async () => {
    const err = new Error('timeout of 15000ms exceeded') as any;
    err.code = 'ECONNABORTED';
    mockedAxios.post.mockRejectedValueOnce(err);

    await expect(
      service.parseVisit(audio, 'audio/webm', ctx),
    ).rejects.toThrow(RequestTimeoutException);
  });

  it('cleans invalid color to null', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                transcript: '今天',
                visitDate: null,
                provinceCode: null,
                cityName: null,
                department: null,
                contactPerson: null,
                contactTitle: null,
                outcomeSummary: null,
                color: 'purple',
                followUp: null,
              }),
            },
          },
        ],
      },
    });

    const result = await service.parseVisit(audio, 'audio/webm', ctx);
    expect(result.parsed.color).toBeNull();
  });

  it('cleans empty string fields to null', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        choices: [
          {
            message: {
              content: JSON.stringify({
                transcript: '今天',
                visitDate: '',
                provinceCode: '   ',
                cityName: null,
                department: '上海发改委',
                contactPerson: null,
                contactTitle: null,
                outcomeSummary: null,
                color: null,
                followUp: null,
              }),
            },
          },
        ],
      },
    });

    const result = await service.parseVisit(audio, 'audio/webm', ctx);
    expect(result.parsed.visitDate).toBeNull();
    expect(result.parsed.provinceCode).toBeNull();
    expect(result.parsed.department).toBe('上海发改委');
  });
});
```

- [ ] **Step 3: 跑测试**

Run: `cd apps/api && npm test -- voice.service.spec.ts`
Expected: 7 个 test 全过 (`PASS  src/voice/voice.service.spec.ts`)

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/voice/voice.service.spec.ts
git commit -m "test(api/voice): unit tests for prompt parsing and error paths"
```

---

## Task 5: 前端 API 客户端

**Files:**
- Create: `apps/web/src/api/voice.ts`

- [ ] **Step 1: 创建 voice.ts**

文件内容 `apps/web/src/api/voice.ts`:

```ts
import { authHeaders } from '@/lib/api';
import type {
  VoiceParseVisitContext,
  VoiceParseVisitResponse,
} from '@pop/shared-types';

/**
 * 调后端 /voice/parse-visit,上传音频 + 上下文,返回解析后的字段
 *
 * 错误情况:抛 Error,message 是后端返回的友好文字(message 字段)
 */
export async function fetchVoiceParseVisit(
  audio: Blob,
  context: VoiceParseVisitContext,
  signal?: AbortSignal,
): Promise<VoiceParseVisitResponse> {
  const fd = new FormData();
  fd.append('audio', audio);
  fd.append('context', JSON.stringify(context));

  const r = await fetch('/api/v1/voice/parse-visit', {
    method: 'POST',
    headers: authHeaders(), // 注意:不要手动设 Content-Type,fetch 会自动加 boundary
    body: fd,
    signal,
  });

  if (!r.ok) {
    let msg = `语音解析失败 (HTTP ${r.status})`;
    try {
      const j = await r.json();
      if (j.message) msg = typeof j.message === 'string' ? j.message : msg;
    } catch {
      /* 忽略 */
    }
    throw new Error(msg);
  }

  return r.json();
}
```

- [ ] **Step 2: typecheck**

Run: `npm run typecheck --workspace=@pop/web`
Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/api/voice.ts
git commit -m "feat(web/api): add fetchVoiceParseVisit client"
```

---

## Task 6: 前端 VoiceRecorderButton 组件

**Files:**
- Create: `apps/web/src/components/VoiceRecorderButton.tsx`

- [ ] **Step 1: 创建组件**

文件内容 `apps/web/src/components/VoiceRecorderButton.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { Button, message } from 'antd';
import { AudioOutlined, AudioMutedOutlined, LoadingOutlined } from '@ant-design/icons';
import type {
  VoiceParseVisitContext,
  VoiceParsedFields,
} from '@pop/shared-types';
import { fetchVoiceParseVisit } from '@/api/voice';

interface Props {
  /** 解析成功回调,parsed 里 null 字段表示模型未识别 */
  onParsed: (parsed: VoiceParsedFields, transcript: string) => void;
  /** 解析失败回调,展示友好提示用 */
  onError?: (msg: string) => void;
  /** 上下文获取函数(每次开始上传前调用,确保拿到最新值) */
  getContext: () => VoiceParseVisitContext;
  disabled?: boolean;
}

const MAX_SECONDS = 60;
const CLIENT_TIMEOUT_MS = 20_000; // 客户端兜底超时,后端是 15s

type State = 'idle' | 'recording' | 'parsing';

export function VoiceRecorderButton({
  onParsed,
  onError,
  getContext,
  disabled,
}: Props) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const [state, setState] = useState<State>('idle');
  const [seconds, setSeconds] = useState(0);

  const supported = typeof window !== 'undefined' && 'MediaRecorder' in window;

  // 卸载时清理
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startTimer = () => {
    setSeconds(0);
    timerRef.current = window.setInterval(() => {
      setSeconds((s) => {
        const next = s + 1;
        if (next >= MAX_SECONDS) {
          stopRecording();
        }
        return next;
      });
    }, 1000) as unknown as number;
  };

  const stopTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const start = async () => {
    if (!supported) {
      message.error('你的浏览器不支持录音(需要 MediaRecorder)');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = handleStop;
      mr.start();
      recorderRef.current = mr;
      setState('recording');
      startTimer();
    } catch (e) {
      const err = e as Error;
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message.error('麦克风权限被拒,请到浏览器设置允许');
      } else if (err.name === 'NotFoundError') {
        message.error('没有可用的麦克风设备');
      } else {
        message.error(`录音启动失败:${err.message}`);
      }
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    stopTimer();
  };

  const handleStop = async () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setState('parsing');

    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    if (blob.size === 0) {
      message.error('录音为空,请重试');
      setState('idle');
      return;
    }

    const ctrl = new AbortController();
    const timeoutId = window.setTimeout(() => ctrl.abort(), CLIENT_TIMEOUT_MS);

    try {
      const data = await fetchVoiceParseVisit(blob, getContext(), ctrl.signal);
      onParsed(data.parsed, data.transcript);
    } catch (e) {
      const msg =
        (e as Error).name === 'AbortError'
          ? 'AI 解析超时,可重试或手填'
          : (e as Error).message;
      message.error(msg);
      onError?.(msg);
    } finally {
      window.clearTimeout(timeoutId);
      setState('idle');
    }
  };

  const handleClick = () => {
    if (state === 'idle') start();
    else if (state === 'recording') stopRecording();
    // parsing 时按钮 disabled,点不了
  };

  const formatTime = (s: number) => {
    const mm = Math.floor(s / 60);
    const ss = (s % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };

  // 三态 UI
  if (state === 'recording') {
    return (
      <Button
        type="primary"
        danger
        size="large"
        block
        icon={<AudioOutlined />}
        onClick={handleClick}
        style={{
          height: 64,
          fontSize: 16,
          fontWeight: 600,
          background: 'linear-gradient(135deg, #ff4d4f 0%, #ff7a45 100%)',
          borderColor: '#ff4d4f',
          animation: 'pop-pulse 1s ease-in-out infinite',
        }}
      >
        🔴 录音中 {formatTime(seconds)} / 1:00 — 点击停止
      </Button>
    );
  }

  if (state === 'parsing') {
    return (
      <Button
        type="primary"
        danger
        size="large"
        block
        icon={<LoadingOutlined />}
        disabled
        style={{
          height: 64,
          fontSize: 16,
          fontWeight: 600,
          background: 'linear-gradient(135deg, #ff4d4f 0%, #ff7a45 100%)',
          borderColor: '#ff4d4f',
          opacity: 0.8,
        }}
      >
        ⏳ AI 解析中 — 约 5-10 秒...
      </Button>
    );
  }

  // idle
  return (
    <Button
      type="primary"
      danger
      size="large"
      block
      icon={supported ? <AudioOutlined /> : <AudioMutedOutlined />}
      onClick={handleClick}
      disabled={!supported || disabled}
      style={{
        height: 64,
        fontSize: 16,
        fontWeight: 600,
        background: supported
          ? 'linear-gradient(135deg, #ff4d4f 0%, #ff7a45 100%)'
          : undefined,
        borderColor: supported ? '#ff4d4f' : undefined,
      }}
    >
      🎙️ 语音录入 — 点击开始,说完再点停止
    </Button>
  );
}
```

- [ ] **Step 2: 加 CSS 脉冲动画到全局样式**

修改 `apps/web/src/index.css`(若存在)或 `apps/web/src/main.tsx` 顶部 import 的全局 css:

Run: `find apps/web/src -name "*.css" -maxdepth 3`
Expected: 找到一个 `index.css` 或 `main.css`

在该 CSS 文件末尾追加:

```css
@keyframes pop-pulse {
  0%   { box-shadow: 0 0 0 0 rgba(255, 77, 79, 0.5); }
  70%  { box-shadow: 0 0 0 10px rgba(255, 77, 79, 0); }
  100% { box-shadow: 0 0 0 0 rgba(255, 77, 79, 0); }
}
```

- [ ] **Step 3: typecheck**

Run: `npm run typecheck --workspace=@pop/web`
Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/VoiceRecorderButton.tsx apps/web/src/index.css
git commit -m "feat(web): add VoiceRecorderButton with three-state UI"
```

---

## Task 7: 前端 MobileVisitNewPage 集成(button + banner + setFieldsValue)

**Files:**
- Modify: `apps/web/src/pages/mobile/MobileVisitNewPage.tsx`

- [ ] **Step 1: 看一遍当前文件结构(熟悉改动位置)**

Run: `head -60 apps/web/src/pages/mobile/MobileVisitNewPage.tsx`
Expected: 看到当前 R2.6 实现,找到 import / state / Form 主体三个块

- [ ] **Step 2: 完整覆盖 MobileVisitNewPage.tsx**

文件内容 `apps/web/src/pages/mobile/MobileVisitNewPage.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  Radio,
  Select,
  Space,
  Switch,
  Typography,
  message,
} from 'antd';
import { EnvironmentOutlined, LogoutOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  CreateVisitInput,
  CityListResponse,
  VoiceParsedFields,
  VoiceParseVisitContext,
} from '@pop/shared-types';
import { authHeaders } from '@/lib/api';
import { useAuthStore } from '@/stores/auth';
import { palette } from '@/tokens';
import { VoiceRecorderButton } from '@/components/VoiceRecorderButton';

const { Title, Text } = Typography;

interface FormValues {
  visitDate: Dayjs;
  provinceCode: string;
  cityName: string;
  department: string;
  contactPerson: string;
  contactTitle?: string;
  outcomeSummary: string;
  color: 'red' | 'yellow' | 'green';
  followUp: boolean;
}

const REQUIRED_FOR_SUBMIT: (keyof FormValues)[] = [
  'provinceCode',
  'cityName',
  'department',
  'contactPerson',
  'outcomeSummary',
];

const FIELD_LABEL_ZH: Record<string, string> = {
  provinceCode: '省',
  cityName: '市',
  department: '对接部门',
  contactPerson: '对接人',
  outcomeSummary: '产出描述',
};

async function fetchCities(): Promise<CityListResponse> {
  const r = await fetch('/api/v1/cities', { headers: authHeaders() });
  if (!r.ok) throw new Error('cities fetch fail');
  return r.json();
}

async function postVisit(input: CreateVisitInput): Promise<void> {
  const r = await fetch('/api/v1/visits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? 'visit 创建失败');
  }
}

/**
 * 移动端 — 已拜访录入(R2.7: GPS 禁用 + 省市下拉 + 语音录入 + LLM 自动填表)
 */
export function MobileVisitNewPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [form] = Form.useForm<FormValues>();
  const [missingAfterVoice, setMissingAfterVoice] = useState<string[]>([]);

  const { data: cityList } = useQuery({
    queryKey: ['cities'],
    queryFn: fetchCities,
    staleTime: Infinity,
  });

  const provinceOptions = useMemo(
    () =>
      (cityList?.data ?? []).map((p) => ({
        label: p.provinceName,
        value: p.provinceCode,
      })),
    [cityList],
  );

  const selectedProvince = Form.useWatch('provinceCode', form);

  const cityOptions = useMemo(() => {
    const p = cityList?.data.find((x) => x.provinceCode === selectedProvince);
    return (p?.cities ?? []).map((c) => ({ label: c.name, value: c.name }));
  }, [cityList, selectedProvince]);

  const submitMutation = useMutation({
    mutationFn: async (vs: FormValues) => {
      const input: CreateVisitInput = {
        status: 'completed',
        visitDate: vs.visitDate.format('YYYY-MM-DD'),
        department: vs.department,
        contactPerson: vs.contactPerson,
        contactTitle: vs.contactTitle || undefined,
        outcomeSummary: vs.outcomeSummary,
        color: vs.color,
        followUp: vs.followUp,
        provinceCode: vs.provinceCode,
        cityName: vs.cityName,
      };
      await postVisit(input);
    },
    onSuccess: () => {
      message.success('已录入');
      navigate('/m/done');
    },
    onError: (e) => message.error(`提交失败: ${(e as Error).message}`),
  });

  // —— 语音解析回调 ——

  const getVoiceContext = (): VoiceParseVisitContext => ({
    today: dayjs().format('YYYY-MM-DD'),
    currentProvinceCode: form.getFieldValue('provinceCode') || null,
    currentCityName: form.getFieldValue('cityName') || null,
  });

  const handleVoiceParsed = (parsed: VoiceParsedFields, transcript: string) => {
    // 转 dayjs 后,filter 掉 null/undefined,setFieldsValue 字段级覆盖
    const next: Partial<FormValues> = {};
    if (parsed.visitDate) next.visitDate = dayjs(parsed.visitDate);
    if (parsed.provinceCode) next.provinceCode = parsed.provinceCode;
    if (parsed.cityName) next.cityName = parsed.cityName;
    if (parsed.department) next.department = parsed.department;
    if (parsed.contactPerson) next.contactPerson = parsed.contactPerson;
    if (parsed.contactTitle) next.contactTitle = parsed.contactTitle;
    if (parsed.outcomeSummary) next.outcomeSummary = parsed.outcomeSummary;
    if (parsed.color) next.color = parsed.color;
    if (parsed.followUp !== null) next.followUp = parsed.followUp;

    form.setFieldsValue(next);

    // 检查必填字段缺失
    const after = { ...form.getFieldsValue(), ...next };
    const missing = REQUIRED_FOR_SUBMIT.filter((k) => {
      const v = after[k];
      return v === undefined || v === null || v === '';
    }).map((k) => FIELD_LABEL_ZH[k] ?? k);

    setMissingAfterVoice(missing);
    message.success(`语音已识别(${transcript.length} 字)`);
  };

  // 用户改字段时,重新计算 missing(消失或新增)
  const handleValuesChange = (
    _changed: Partial<FormValues>,
    all: Partial<FormValues>,
  ) => {
    if (missingAfterVoice.length === 0) return;
    const stillMissing = REQUIRED_FOR_SUBMIT.filter((k) => {
      const v = all[k];
      return v === undefined || v === null || v === '';
    }).map((k) => FIELD_LABEL_ZH[k] ?? k);
    setMissingAfterVoice(stillMissing);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: palette.bgBase,
        padding: '12px 16px 32px',
      }}
    >
      {/* 极简顶栏 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <Space size={6}>
          <span style={{ fontSize: 18 }}>📍</span>
          <Text strong style={{ fontSize: 14, color: palette.primary }}>
            POP · 移动录入
          </Text>
        </Space>
        <Space size={4}>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {user?.displayName ?? ''}
          </Text>
          <Button
            type="text"
            size="small"
            icon={<LogoutOutlined />}
            onClick={() => {
              logout();
              navigate('/login');
            }}
            aria-label="登出"
            style={{ color: palette.textMuted }}
          />
        </Space>
      </div>

      <Title
        level={4}
        style={{
          color: palette.primary,
          marginTop: 0,
          marginBottom: 16,
          fontSize: 20,
        }}
      >
        新建拜访
      </Title>

      {/* R2.7 — 语音录入按钮(最前面 + 鲜艳红) */}
      <div style={{ marginBottom: 12 }}>
        <VoiceRecorderButton
          onParsed={handleVoiceParsed}
          getContext={getVoiceContext}
          disabled={submitMutation.isPending}
        />
      </div>

      {/* 必填字段缺失横幅 */}
      {missingAfterVoice.length > 0 && (
        <Alert
          type="warning"
          showIcon
          closable
          onClose={() => setMissingAfterVoice([])}
          message={`AI 没识别到:${missingAfterVoice.join('、')},请下方补充`}
          style={{ marginBottom: 12, fontSize: 13 }}
        />
      )}

      {/* GPS 按钮 — R2.6 暂时禁用 */}
      <div style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          size="large"
          block
          icon={<EnvironmentOutlined />}
          disabled
          style={{ height: 56, fontSize: 16 }}
        >
          一键定位(GPS)
        </Button>
        <Text
          type="secondary"
          style={{
            fontSize: 12,
            display: 'block',
            textAlign: 'center',
            marginTop: 6,
          }}
        >
          GPS 暂未启用,请下方手选省市
        </Text>
      </div>

      {/* 表单 */}
      <Form<FormValues>
        form={form}
        layout="vertical"
        size="large"
        initialValues={{
          visitDate: dayjs(),
          followUp: false,
          color: 'green',
        }}
        onFinish={(vs) => submitMutation.mutate(vs)}
        onValuesChange={handleValuesChange}
        disabled={submitMutation.isPending}
      >
        <Form.Item
          label="拜访日期"
          name="visitDate"
          rules={[{ required: true }]}
        >
          <DatePicker style={{ width: '100%' }} inputReadOnly />
        </Form.Item>
        <Form.Item
          label="省"
          name="provinceCode"
          rules={[{ required: true }]}
        >
          <Select
            options={provinceOptions}
            onChange={() =>
              form.setFieldsValue({ cityName: undefined as unknown as string })
            }
            showSearch
            optionFilterProp="label"
            placeholder="选择省级"
          />
        </Form.Item>
        <Form.Item label="市" name="cityName" rules={[{ required: true }]}>
          <Select
            options={cityOptions}
            disabled={!selectedProvince}
            showSearch
            optionFilterProp="label"
            placeholder={selectedProvince ? '选择市级' : '请先选省'}
          />
        </Form.Item>
        <Form.Item
          label="对接部门"
          name="department"
          rules={[{ required: true, max: 128 }]}
        >
          <Input placeholder="例:上海市发改委" maxLength={128} />
        </Form.Item>
        <Form.Item
          label="对接人"
          name="contactPerson"
          rules={[{ required: true, max: 64 }]}
        >
          <Input placeholder="例:张处长" maxLength={64} />
        </Form.Item>
        <Form.Item
          label="对接人职务(可选)"
          name="contactTitle"
          rules={[{ max: 64 }]}
        >
          <Input placeholder="例:综合处处长" maxLength={64} />
        </Form.Item>
        <Form.Item
          label="产出描述"
          name="outcomeSummary"
          rules={[{ required: true }]}
        >
          <Input.TextArea
            rows={4}
            placeholder="一句话总结这次拜访的产出"
            maxLength={500}
            showCount
          />
        </Form.Item>
        <Form.Item label="颜色" name="color" rules={[{ required: true }]}>
          <Radio.Group buttonStyle="solid" style={{ width: '100%', display: 'flex' }}>
            <Radio.Button
              value="green"
              style={{
                flex: 1,
                textAlign: 'center',
                height: 44,
                lineHeight: '40px',
              }}
            >
              🟢 常规
            </Radio.Button>
            <Radio.Button
              value="yellow"
              style={{
                flex: 1,
                textAlign: 'center',
                height: 44,
                lineHeight: '40px',
              }}
            >
              🟡 层级提升
            </Radio.Button>
            <Radio.Button
              value="red"
              style={{
                flex: 1,
                textAlign: 'center',
                height: 44,
                lineHeight: '40px',
              }}
            >
              🔴 紧急
            </Radio.Button>
          </Radio.Group>
        </Form.Item>
        <Form.Item
          label="是否需要后续跟进"
          name="followUp"
          valuePropName="checked"
        >
          <Switch />
        </Form.Item>

        <Button
          type="primary"
          htmlType="submit"
          block
          size="large"
          loading={submitMutation.isPending}
          style={{ height: 56, fontSize: 16, marginTop: 8 }}
        >
          提交
        </Button>
      </Form>

      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Link to="/" style={{ fontSize: 12, color: palette.textMuted }}>
          回桌面端 →
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: typecheck 整个 monorepo**

Run: `npm run typecheck`
Expected: 三个 workspace 都通过(shared-types / api / web)

- [ ] **Step 4: 本地 dev 跑前端 + 手动看一眼 UI**

Run: `npm run dev:web`
打开 `http://localhost:5173/m/visit/new`(需先登录)
Expected: 红色「🎙️ 语音录入」按钮出现在最顶部,GPS 灰按钮在下方;省市下拉、其他字段都正常。
**注意**:这一步本地不会触发真实语音解析(后端 stub 只返 stub 数据 + 没有 MINIMAX_API_KEY),只是确认 UI 渲染没问题。点录音按钮会弹麦克风权限,然后停止后会调到 stub 返回 "(stub) 这是 stub 实现..." —— 字段会被 stub 的 visitDate 覆盖,符合预期。

- [ ] **Step 5: 停 dev 服务**

`Ctrl+C` 停止 vite

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/mobile/MobileVisitNewPage.tsx
git commit -m "feat(web/mobile): integrate VoiceRecorderButton + missing-fields banner"
```

---

## Task 8: 部署 + 真机验证

**Files (server-side):**
- Modify: `/opt/pop/.env`(加 MINIMAX_API_KEY、MINIMAX_BASE_URL)

- [ ] **Step 1: Push 所有 commit 到 GitHub**

```bash
git push origin claude/mobile-visit-entry
```
Expected: 看到 7 个 commit 推上去(Task 1-7 各 1 个)

- [ ] **Step 2: 服务器加 MINIMAX env**

⚠️ 替换 `<USER_KEY>` 为用户提供的真实 key:

```bash
ssh -o BatchMode=yes root@47.238.72.38 '
  set -e
  cd /opt/pop
  # 检查 .env 是否已有 MINIMAX_API_KEY,有就 skip
  if grep -q "^MINIMAX_API_KEY=" .env; then
    echo "MINIMAX_API_KEY already set"
  else
    echo "MINIMAX_API_KEY=<USER_KEY>" >> .env
    echo "MINIMAX_BASE_URL=https://api.minimaxi.com/v1" >> .env
    echo "added"
  fi
  # 验证(脱敏显示)
  grep -E "^MINIMAX" .env | sed "s/=.\{20\}.*/=<HIDDEN>/"
'
```
Expected: 看到 `MINIMAX_API_KEY=<HIDDEN>` 和 `MINIMAX_BASE_URL=https://api.minimaxi.com/v1`

- [ ] **Step 3: 服务器拉新代码 + rebuild + restart**

```bash
ssh -o BatchMode=yes root@47.238.72.38 '
  set -e
  cd /opt/pop
  
  echo "=== 1) git pull ==="
  git fetch origin
  git reset --hard origin/claude/mobile-visit-entry
  git log --oneline -3
  
  echo ""
  echo "=== 2) 重 build ==="
  rm -rf packages/shared-types/dist apps/api/dist apps/web/dist
  npm run build:shared 2>&1 | tail -3
  npm run build:api 2>&1 | tail -3
  NODE_OPTIONS="--max-old-space-size=1536" npm run build:web 2>&1 | tail -8
  
  echo ""
  echo "=== 3) pm2 restart ==="
  pm2 restart pop-api
  sleep 3
  pm2 list | grep pop-api
  
  echo ""
  echo "=== 4) API 健康 ==="
  curl -s -o /dev/null -w "  首页 : %{http_code}\n" http://127.0.0.1/
  curl -s -o /dev/null -w "  /m/visit/new : %{http_code}\n" http://127.0.0.1/m/visit/new
  curl -s -X POST -H "Content-Type: application/json" -d "{\"username\":\"sysadmin\",\"password\":\"pop2026\"}" -o /tmp/login.json -w "  login : %{http_code}\n" http://127.0.0.1/api/v1/auth/login
'
```
Expected:
- build 全过
- pm2 状态 online
- 首页 200 / /m/visit/new 200 / login 201

- [ ] **Step 4: 服务器 curl 测真实 voice endpoint(不带音频先测错误路径)**

```bash
ssh -o BatchMode=yes root@47.238.72.38 '
  ACCESS=$(curl -s -X POST -H "Content-Type: application/json" -d "{\"username\":\"sysadmin\",\"password\":\"pop2026\"}" http://127.0.0.1/api/v1/auth/login | sed -n "s/.*\"accessToken\":\"\([^\"]*\)\".*/\1/p")
  
  echo "=== 不带 audio ==="
  curl -s -o /tmp/r.json -w "HTTP %{http_code}\n" -X POST http://127.0.0.1/api/v1/voice/parse-visit \
    -H "Authorization: Bearer $ACCESS" \
    -F "context={\"today\":\"2026-04-29\"}"
  cat /tmp/r.json; echo
  
  echo "=== context 错 ==="
  echo -n fake > /tmp/fake.webm
  curl -s -o /tmp/r.json -w "HTTP %{http_code}\n" -X POST http://127.0.0.1/api/v1/voice/parse-visit \
    -H "Authorization: Bearer $ACCESS" \
    -F "audio=@/tmp/fake.webm;type=audio/webm" \
    -F "context=bad-json"
  cat /tmp/r.json; echo
  
  echo "=== 假 audio + 真 context(应该会让 MiniMax 报 invalid audio data) ==="
  curl -s -o /tmp/r.json -w "HTTP %{http_code}\n" -X POST http://127.0.0.1/api/v1/voice/parse-visit \
    -H "Authorization: Bearer $ACCESS" \
    -F "audio=@/tmp/fake.webm;type=audio/webm" \
    -F "context={\"today\":\"2026-04-29\"}"
  cut -c 1-300 /tmp/r.json; echo
'
```
Expected:
- 不带 audio → HTTP 400 + "audio 字段缺失"
- context 错 → HTTP 400 + "context 必须是合法 JSON 字符串"
- 假 audio → HTTP 502 + "AI 返回格式错误" 或类似(MiniMax 拒绝假音频)

- [ ] **Step 5: 真机端到端验证 — happy path**

打开手机浏览器(必须 HTTPS,目前还是 http://47.238.72.38 所以**用 Chrome 桌面打开手机模拟模式 + 允许 macrecord** 或等域名通过升 HTTPS 后用真机)。

**步骤:**
1. 浏览器开 `http://47.238.72.38/m/visit/new` 并登录
2. 点击红色「🎙️ 语音录入」按钮
3. 浏览器弹麦克风权限 → 允许
4. 看到按钮变红 + 倒计时 0:01 0:02 ...
5. 说一段标准语料(慢速清晰):

   > "今天上午我去上海发改委拜访张处长,谈了半导体补贴政策,他答应下周协调绿色通道,这事比较紧急,需要后续跟进"

6. 再点击按钮停止
7. 看到「⏳ AI 解析中 — 约 5-10 秒...」
8. 5-10 秒后字段被填好:
   - 拜访日期 = 2026-04-29
   - 省 = 上海市
   - 市 = 上海市(或浦东新区)
   - 对接部门 = 上海发改委
   - 对接人 = 张处长
   - 对接人职务 = 处长
   - 产出描述 = 谈了半导体补贴政策...
   - 颜色 = 🔴 紧急
   - 跟进 = ⬤(开)
9. 点提交 → 跳到 /m/done(成功页)
10. 桌面端浏览器 `http://47.238.72.38/console/visits` 看到这条新拜访(visitDate=2026-04-29 / 上海市 / 张处长)

Expected: 全 10 步通过。

- [ ] **Step 6: 真机端到端验证 — 边界场景**

边界 1:**没说省市,已选下拉框**
1. 进 `/m/visit/new`,先在下拉框选「上海市 / 浦东新区」
2. 点录音 → 说"我今天去发改委找张处长谈了补贴" → 停止
3. 等待解析
4. ✓ 看到省市仍然是「上海市 / 浦东新区」(没被语音覆盖成 null/空)
5. ✓ 看到 department=发改委、contactPerson=张处长

边界 2:**说弱地理标签**
1. 不在下拉框选省市(留空)
2. 点录音 → 说"今天去东城区某局拜访领导" → 停止
3. ✓ 省市保持为空(模型不应该瞎推断东城区在哪个城市)
4. 顶部出现黄色横幅「AI 没识别到:省、市、对接人、产出描述」

边界 3:**信息特别短**
1. 进 `/m/visit/new`(不选下拉框)
2. 点录音 → 说"今天去发改委了" → 停止
3. ✓ 顶部出现黄色横幅「AI 没识别到:省、市、对接人、产出描述」
4. 用户在下拉框选「上海/浦东」+ 填对接人/产出 → 横幅自动消失
5. 点提交成功

Expected: 全 3 个边界场景通过。

- [ ] **Step 7: 真机端到端验证 — 错误路径**

错误 1:**拒绝麦克风权限**
1. 浏览器设置里把麦克风权限改成 block,刷新
2. 点录音按钮 → 看到 toast「麦克风权限被拒,请到浏览器设置允许」

错误 2:**录音不说话**
1. 允许权限,点录音 → 安静 5 秒 → 停止
2. 看到 toast「没有识别到内容,请重录」(后端从 transcript 太短判断)

错误 3:**手动模拟 MiniMax 故障(可选)**
- 如果想测 502 路径,临时把 .env 的 MINIMAX_API_KEY 改成 `sk-cp-fake`,pm2 restart,真机点录音 → 看到 toast「AI 服务不可用」
- 测完恢复正确 key

Expected: 错误提示友好,不卡死。

- [ ] **Step 8: 回归 R2.6**

1. 桌面端打开 `/console/visits`,新建一条拜访(VisitFormModal)→ 选省市 → 提交 → 成功
2. 移动端 `/m/visit/new` 不点录音,纯手填省市 + 字段 → 提交 → 成功

Expected: R2.6 路径不退化。

- [ ] **Step 9: 收尾 — 把 .env 加入 .gitignore 检查(防止 key 被 commit)**

Run: `cd /opt/pop && git check-ignore .env && echo "✓ .env is gitignored"`
Expected: 输出 `.env` + `✓ .env is gitignored`

如果输出空,说明 .env 没被 ignore — **立刻**:
```bash
echo ".env" >> .gitignore
git add .gitignore && git commit -m "chore: gitignore .env"
git push
```

- [ ] **Step 10: 最终汇报**

Run(在本地):
```bash
git log --oneline -10
```
Expected: 看到本次 plan 的 7 个 commit + Task 8 的可能加上 .gitignore 修补 commit。

报告给用户:
- ✅ 所有任务完成
- ✅ 真机 happy path / 3 边界 / 3 错误 / 回归 全过
- 🎉 R2.7 上线,可以演示语音录入

---

## Spec coverage check

✓ 决策 1 范围分两次:本 plan 只做 R2.7
✓ 决策 2 GPS 灰显:Task 7 保留(沿用 R2.6 已落地)
✓ 决策 3 全字段解析:Task 1 类型,Task 3 prompt 指定 9 字段
✓ 决策 4 字段级 last write wins:Task 7 `setFieldsValue(next)` 只填 next 里有的字段
✓ 决策 5 UI 最前面 + 鲜艳:Task 7 VoiceRecorderButton 放第一个 + Task 6 红渐变样式
✓ 决策 6 点击切换:Task 6 状态机
✓ 决策 7 直接填表:Task 7 `handleVoiceParsed`(无确认弹窗)
✓ 决策 8 简单 Spin:Task 6 parsing 态显示 LoadingOutlined + 文字
✓ 决策 9 60 秒上限:Task 6 `MAX_SECONDS = 60` + 计时器自动 stopRecording
✓ 决策 10 MiniMax-M2.7-highspeed:Task 3 `this.model = 'MiniMax-M2.7-highspeed'`
✓ 决策 11 后端中转:Task 2-4 整个后端模块
✓ 修补 1 null filter:Task 7 `if (parsed.X) next.X = ...`
✓ 修补 2 强弱标签:Task 3 prompt 规则 #3
✓ 修补 3 黄色横幅:Task 7 `missingAfterVoice` state + `<Alert type="warning">`
✓ 错误处理矩阵 8 类:Task 6 (前端 4 类) + Task 3-4 (后端 4 类)
✓ 测试场景 19 项:Task 8 Step 5-8 覆盖

---

## Type consistency check

- `VoiceParseVisitContext` / `VoiceParsedFields` / `VoiceParseVisitResponse`:Task 1 定义 → Task 2 controller import → Task 3 service 用 → Task 5 api 客户端 import → Task 6 组件 import → Task 7 集成 import,**全程一致**
- `getContext()` 返回 `VoiceParseVisitContext`:Task 6 props.getContext + Task 7 `getVoiceContext`,签名匹配
- `onParsed(parsed: VoiceParsedFields, transcript: string)`:Task 6 props + Task 7 `handleVoiceParsed`,签名匹配
- 错误 throw:`BadRequestException` (400) / `RequestTimeoutException` (408) / `BadGatewayException` (502) / `InternalServerErrorException` (500),NestJS 内置全部一致
- 提示词字段名 = JSON schema 字段名 = TypeScript 接口字段名,9 个字段全程对齐

---

## Plan complete

预估总实施时间:**~9 小时**(8 个任务,Task 1/4/5 较短,Task 2/3/6/7 较长,Task 8 含真机验证)
