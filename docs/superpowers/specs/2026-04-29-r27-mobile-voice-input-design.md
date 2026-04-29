# R2.7 移动端语音输入 + LLM 解析 · Design Spec

> 日期:2026-04-29
> 范围:前端 1 文件改 + 1 新组件 / 后端 1 新模块 / 0 数据库改动
> 实施预估:~9 小时(含 3 个边界场景修补)

---

## Context · 为什么做这个

R2.5 给移动端做了快速录入表单(GPS 一键定位 → 反查 → 填省市,然后手填其他字段)。R2.6 因 HTTPS / 演示考虑临时禁用了 GPS,改为下拉框手选省市。**R2.7 在此基础上加语音输入 + LLM 自动解析**,让用户在拜访结束后口述一段话,自动填好整张表单(7 个字段),再编辑微调即可提交。

核心心智:**语音是快速通道,模型敢错就改**。语音解析的字段直接填表,用户改任何字段以最后输入为准(last write wins)。

---

## Decisions(brainstorm 已逐项拍)

| # | 决策点 | 选项 | 拍板 |
|---|---|---|---|
| 1 | 范围 | A 合并 / B 分两次 PR | **B 分两次** — R2.6 先上线,R2.7 单独迭代 |
| 2 | GPS 按钮处置 | A 删 / B 灰显 / C 弹 toast | **B 灰显**,下方提示「GPS 暂未启用」(已在 R2.6 落地) |
| 3 | 语音解析字段范围 | A 只事项 / B 加时间 / C 全字段 | **C 全字段**(7 个字段全解) |
| 4 | 字段冲突 | last write wins | **字段级**:语音解析的字段才覆盖,没解析到的不动 |
| 5 | UI 位置 | — | **最前面**(GPS 按钮上方),**鲜艳**(红渐变) |
| 6 | 录音触发 | A 长按 / B 点击切换 / C 两路并存 | **B 点击切换** — 移动端最稳 |
| 7 | 解析后 UX | A 直接填 / B 弹窗确认 / C 视觉标识 | **A 直接填** — 出错改字段成本极低 |
| 8 | Loading 形态 | A Spin+文字 / B 假阶段 / C 真 SSE | **A Spin+文字**「AI 解析中,约 5-10 秒...」 |
| 9 | 录音时长上限 | 30 / 60 / 90 秒 | **60 秒**,到点自动停止 |
| 10 | 模型 | — | **MiniMax-M2.7-highspeed**(原生多模态,音频直接输入) |
| 11 | API 接入 | 前端直调 / 后端中转 | **后端中转** — key 不暴露 + JWT 校验防滥用 |

---

## Architecture

```
┌─────────────────┐
│ 移动浏览器       │
│ (MediaRecorder) │  录 webm/opus,60s 上限
└────────┬────────┘
         │ POST /api/v1/voice/parse-visit
         │ FormData(audio: Blob, context: JSON)
         ▼
┌─────────────────┐
│  NestJS API     │  ① JWT 校验
│  voice.service  │  ② Multer 接收 audio → base64
└────────┬────────┘  ③ 组装 prompt + audio
         │ POST https://api.minimaxi.com/v1/chat/completions
         │ axios timeout 15s
         ▼
┌─────────────────┐
│  MiniMax LLM    │  原生多模态:音频 + prompt → JSON
│  M2.7-highspeed │  reasoning model (~3-8s)
└────────┬────────┘
         │ JSON { transcript, parsed: {...7 fields} }
         ▼
┌─────────────────┐
│  NestJS         │  ④ try parse JSON,失败抛 502
│                 │  ⑤ 校验字段类型,返回前端
└────────┬────────┘
         ▼
┌─────────────────┐
│ 浏览器          │  ⑥ filter null 字段(修补 1)
│ form           │  ⑦ setFieldsValue(cleaned)
│ setFieldsValue │  ⑧ 检查必填字段空缺 → 顶部黄色横幅(修补 3)
└─────────────────┘  ⑨ loading 关闭,用户编辑/提交
```

---

## 文件清单

**前端**

```
apps/web/src/components/VoiceRecorderButton.tsx  [新]
apps/web/src/pages/mobile/MobileVisitNewPage.tsx [改:加录音按钮 + setFieldsValue + 横幅]
apps/web/src/api/voice.ts                        [新:fetchVoiceParseVisit]
```

**后端**

```
apps/api/src/voice/voice.module.ts               [新]
apps/api/src/voice/voice.controller.ts           [新]
apps/api/src/voice/voice.service.ts              [新:含提示词 + MiniMax 调用]
apps/api/src/voice/dto/parse-visit.dto.ts        [新]
apps/api/src/app.module.ts                       [改:挂 VoiceModule]
apps/api/.env(实际是仓库根 /opt/pop/.env)        [改:加 MINIMAX_API_KEY、MINIMAX_BASE_URL]
```

---

## API 接口

### POST /api/v1/voice/parse-visit

**Request**(multipart/form-data):

```
Authorization: Bearer <JWT>
Content-Type: multipart/form-data; boundary=...

audio: Blob (webm/opus, ≤ 1MB,服务端额外校验)
context: JSON string {
  today: "2026-04-29",                 // 当前日期
  currentProvinceCode?: "310000",      // 用户已选(可空)
  currentCityName?: "浦东新区"
}
```

**Response 200**:

```json
{
  "transcript": "今天上午我去上海发改委拜访张处长...",
  "parsed": {
    "visitDate": "2026-04-29",
    "provinceCode": "310000",
    "cityName": "上海市",
    "department": "上海发改委",
    "contactPerson": "张处长",
    "contactTitle": "处长",
    "outcomeSummary": "谈了半导体补贴政策,下周协调绿色通道",
    "color": "red",
    "followUp": true
  }
}
```

注意 `parsed` 里**任意字段值可能是 `null`**,表示模型未识别到该字段。前端必须 filter null 后再 setFieldsValue。

**Response 错误**:

| HTTP | 场景 | 响应 |
|---|---|---|
| 400 | 音频缺失/格式不对/context JSON 错 | `{ message: "..." }` |
| 401 | JWT 无效 | NestJS 默认 |
| 408 | MiniMax 超时(后端 axios 15s) | `{ message: "AI 解析超时" }` |
| 502 | MiniMax 返回非 JSON / 字段缺失 | `{ message: "AI 返回格式错误" }` |
| 500 | 其他后端错误 | `{ message: "..." }` |

---

## 提示词(系统级 prompt + few-shot)

后端组装时填充三个变量:`{TODAY}` / `{CURRENT_PROVINCE_NAME}` / `{CURRENT_CITY_NAME}`(后两者为 null 时填 "未选")。

```
你是政策拜访记录辅助 AI。任务:把用户的语音转写为结构化字段,用于自动填写"已完成拜访"录入表单。

【输入】
- 音频:用户口述的本次拜访经过(普通话,可能含方言口音)
- 当前日期:{TODAY}
- 用户已选省市:{CURRENT_PROVINCE_NAME} / {CURRENT_CITY_NAME}(可能为"未选")
- 中国省份代码表:
  北京市=110000、天津市=120000、河北省=130000、山西省=140000、内蒙古自治区=150000、
  辽宁省=210000、吉林省=220000、黑龙江省=230000、上海市=310000、江苏省=320000、
  浙江省=330000、安徽省=340000、福建省=350000、江西省=360000、山东省=370000、
  河南省=410000、湖北省=420000、湖南省=430000、广东省=440000、广西壮族自治区=450000、
  海南省=460000、重庆市=500000、四川省=510000、贵州省=520000、云南省=530000、
  西藏自治区=540000、陕西省=610000、甘肃省=620000、青海省=630000、宁夏回族自治区=640000、
  新疆维吾尔自治区=650000、香港特别行政区=810000、澳门特别行政区=820000、台湾省=710000

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

1. transcript:必填,**保持原话**(含口语词、停顿词),便于用户复核

2. visitDate:
   - 用户说"今天/昨天/上周三/4 月 28 号"等表述 → 解析为 YYYY-MM-DD
   - 没说时间 → null(前端会用今天默认)

3. provinceCode + cityName(强弱标签规则):
   - 用户**明确说省/直辖市名** → 填对应 code 和市名
   - 用户说**强地理标签**(浦东、海淀、天河、福田、雁塔、武侯、天府、南山、滨海、
     朝阳[北京]、徐汇、长宁 等明确指向**单一**省市的著名区) → 推断填省市
   - 用户说**弱地理标签**(东城区、西城区、新区、开发区、高新区、城南区等
     **多个城市都有**的)→ **不要推断**,返回 null
   - 用户只说部门名("发改委"/"某局"/"产业园") → **不要推断**,返回 null
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
- 只输出 JSON,首字符必须是 `{`,末字符必须是 `}`,前后无任何文本
- 不要给字段加注释、不要 markdown、不要解释
- 用户语义模糊时选最合理解释;**不确定就 null,不瞎编**
- 转写文本 transcript 保持原话(含口语词、停顿词)

【示例】

用户语音:"今天上午我去上海发改委拜访张处长,谈了半导体补贴政策,他答应下周协调绿色通道,这事比较紧急,需要后续跟进"

输出:
{
  "transcript": "今天上午我去上海发改委拜访张处长,谈了半导体补贴政策,他答应下周协调绿色通道,这事比较紧急,需要后续跟进",
  "visitDate": "{TODAY}",
  "provinceCode": "310000",
  "cityName": "上海市",
  "department": "上海发改委",
  "contactPerson": "张处长",
  "contactTitle": "处长",
  "outcomeSummary": "谈了半导体补贴政策,下周协调绿色通道",
  "color": "red",
  "followUp": true
}

用户语音:"今天去发改委了"

输出:
{
  "transcript": "今天去发改委了",
  "visitDate": "{TODAY}",
  "provinceCode": null,
  "cityName": null,
  "department": "发改委",
  "contactPerson": null,
  "contactTitle": null,
  "outcomeSummary": null,
  "color": null,
  "followUp": null
}
```

---

## 边界场景修补(brainstorm Q&A 后追加)

### 修补 1:null 取代空字符串

**问题**:用户先选了下拉框上海/浦东,然后语音没说省市。模型若返回 `""` 会清空已选值,违反 last write wins。

**修复**:
- 提示词改:**没识别的字段返回 `null`(不是 `""`)**
- 前端 setFieldsValue 前 filter:

```ts
const cleaned = Object.fromEntries(
  Object.entries(parsed).filter(([_, v]) => v !== null && v !== undefined)
);
form.setFieldsValue(cleaned);
```

### 修补 2:强弱地理标签

**问题**:用户说"东城区某局"(弱标签,多城市都有),模型瞎推断会把字段填错。

**修复**:提示词规则 #3 加强弱标签区分:
- 强标签(浦东/海淀/天河 等单一指向) → 推断填
- 弱标签(东城区/新区/开发区) / 纯部门名 → 不推断,返回 null

### 修补 3:解析后必填字段缺失提示

**问题**:用户说"今天去发改委了"(漏了 contactPerson、outcomeSummary)。直接填表会让用户在底部点提交时才被 antd Form `required` 拦下,要滚回上面找哪个红了,移动端体验差。

**修复**:解析完后,前端检查这 4 个**必填字段**:

```ts
const REQUIRED_FIELDS = ['provinceCode', 'cityName', 'department', 'contactPerson', 'outcomeSummary'];
const missing = REQUIRED_FIELDS.filter(f => !cleaned[f] && !form.getFieldValue(f));
```

如果 `missing.length > 0`,**表单顶部显示黄色非阻塞横幅**:

```
┌──────────────────────────────────────┐
│ ⚠️ AI 没识别到:对接人、产出描述       │ ← antd Alert type="warning" closable
│   请下方补充                          │
└──────────────────────────────────────┘
```

用户补完字段后,onValueChange 重新计算 missing,横幅自动消失。

---

## 前端组件设计

### `<VoiceRecorderButton />`

**Props**:

```ts
interface Props {
  onParsed: (parsed: ParsedFields, transcript: string) => void;
  onError: (msg: string) => void;
  context: { today: string; currentProvinceCode?: string; currentCityName?: string };
  disabled?: boolean;
}
```

**内部状态机**:

```
idle ──click──> recording ──click──> uploading ──fetch──> parsing ──ok──> idle
                  │                                          │
                  └─── 60s 自动停止 ────┐                   │
                                       │                   │
                          ┌────────────┘                   │
                          ▼                                ▼
                       uploading                      onError(msg)
```

**UI 三态**:

```
idle:
   ╭───────────────────────────────╮
   │  🎙️ 语音录入                  │ ← 红渐变 #ff4d4f → #ff7a45
   │  点击开始,说完再点停止         │
   ╰───────────────────────────────╯

recording:
   ╭───────────────────────────────╮
   │  🔴 录音中 0:23 / 1:00         │ ← 红色脉冲动画 + 倒计时
   │  点击停止                      │
   ╰───────────────────────────────╯

parsing(uploading + parsing 合并显示):
   ╭───────────────────────────────╮
   │  ⏳ AI 解析中                  │ ← 红 disabled + Spin
   │  约 5-10 秒...                 │
   ╰───────────────────────────────╯
   + 表单整体 disabled(不可手编辑,避免冲突)
```

**核心代码骨架**:

```ts
const recorderRef = useRef<MediaRecorder | null>(null);
const chunksRef = useRef<Blob[]>([]);
const [state, setState] = useState<'idle'|'recording'|'parsing'>('idle');
const [seconds, setSeconds] = useState(0);

async function start() {
  if (!('MediaRecorder' in window)) {
    onError('你的浏览器不支持录音'); return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
    chunksRef.current = [];
    mr.ondataavailable = (e) => chunksRef.current.push(e.data);
    mr.onstop = handleStop;
    mr.start();
    recorderRef.current = mr;
    setState('recording');
    startTimer();  // 1Hz 计数 + 60s 自动停止
  } catch (e) {
    if ((e as Error).name === 'NotAllowedError') onError('麦克风权限被拒');
    else onError('录音启动失败');
  }
}

function stop() { recorderRef.current?.stop(); }

async function handleStop() {
  setState('parsing');
  const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
  const fd = new FormData();
  fd.append('audio', blob);
  fd.append('context', JSON.stringify(props.context));
  try {
    const r = await fetch('/api/v1/voice/parse-visit', {
      method: 'POST', headers: authHeaders(), body: fd,
      signal: AbortSignal.timeout(20000),  // 20s 客户端兜底(后端 15s)
    });
    if (!r.ok) throw new Error((await r.json()).message ?? '解析失败');
    const data = await r.json();
    onParsed(data.parsed, data.transcript);
  } catch (e) { onError((e as Error).message); }
  finally { setState('idle'); }
}
```

---

## UI 改动:`MobileVisitNewPage.tsx`

```
┌────────────────────────────────────────┐
│  📍 POP · 移动录入       邵子渊 ⏏     │
│                                        │
│  新建拜访                              │
│                                        │
│  ┌────────────────────────────────┐   │ ← 新增 R2.7
│  │  🎙️ 语音录入                   │   │   <VoiceRecorderButton />
│  │  点击开始,说完再点停止         │   │
│  └────────────────────────────────┘   │
│                                        │
│  ⚠️ AI 没识别到:对接人,请下方补充     │ ← 横幅(只在缺必填字段时出现)
│                                        │
│  ┌────────────────────────────────┐   │ ← R2.6 GPS 灰显
│  │  📍 一键定位(GPS)              │   │
│  └────────────────────────────────┘   │
│   GPS 暂未启用,请下方手选省市         │
│                                        │
│  拜访日期 *  [ 2026-04-29  📅 ]        │
│  省 *        [ 上海市      ▼  ]        │
│  市 *        [ 浦东新区    ▼  ]        │
│  对接部门 *  [ 上海发改委      ]        │
│  对接人 *    [ 张处长          ]        │
│  对接人职务  [ 处长            ]        │
│  产出描述 *  [ 谈了半导体补贴...]       │
│  颜色 *      [🟢][🟡][🔴 选中]          │
│  跟进        [⬤────────] (开)           │
│  [        提交        ]                │
└────────────────────────────────────────┘
```

---

## 错误处理矩阵

| 错误 | 用户感知 | 实现 |
|---|---|---|
| 浏览器不支持 MediaRecorder | 录音按钮变灰 + tooltip "你的浏览器不支持录音" | 检测 `'MediaRecorder' in window` |
| 麦克风权限被拒 | toast「麦克风权限被拒,请到浏览器设置允许」 | catch `NotAllowedError` |
| 音频上传失败(网络) | toast「上传失败,请检查网络后重试」+ 显示「重试」按钮 | catch fetch error,保留 audio blob 等点重试 |
| 客户端超时(20s) | toast「AI 解析超时,可重试或手填」 | `AbortSignal.timeout(20000)` |
| MiniMax 超时(后端 15s) | 同上 | 后端 axios timeout 15s,返回 408 |
| MiniMax 返回非 JSON | toast「AI 解析失败,可重试或手填」+ 后端 console.error 完整 raw | 后端 try parse,失败抛 502 |
| 必填字段缺失(transcript 空) | toast「没有识别到内容,请重录」 | 后端校验 transcript 非空 |
| LLM 推断错误(用户改字段) | (不算错,正常 last write wins) | 用户直接改 |

---

## 测试 / 验收

### 功能 happy path

1. 真机手机访问 `/m/visit/new` → 看到红色「🎙️ 语音录入」按钮在 GPS 上方
2. 点击 → 浏览器弹麦克风权限 → 允许 → 按钮变录音中(脉冲 + 倒计时 0:00 → 0:60)
3. 说一段标准语料("今天上午我去上海发改委...") → 再点停止
4. Loading 出现「⏳ AI 解析中,约 5-10 秒...」 + 表单半透明
5. 5-10 秒内字段被填(visitDate / 省 / 市 / department / contactPerson / contactTitle / outcomeSummary / color / followUp 都对)
6. 改任何字段 → 表单值更新 → 提交成功
7. 桌面端 console「拜访清单」能看到这条 visit

### 边界场景

8. 用户**没说省市**(已选下拉框) → 模型返回 null → 前端不覆盖,保留下拉框已选值
9. 用户**说"东城区某局"**(弱标签) → 模型返回 null → 不污染省市
10. 用户**说"今天去发改委了"**(漏 contactPerson 等) → 顶部黄色横幅提示「AI 没识别到:对接人、产出描述」→ 用户补完后横幅消失
11. 用户**说"浦东新区发改委"**(强标签 + 没说"上海") → 模型推断 provinceCode=310000 / cityName="浦东新区"

### 错误路径

12. 拒绝麦克风权限 → toast「麦克风权限被拒...」
13. 录音中关掉网络 → toast「上传失败...」+ 看到「重试」按钮
14. Mock MiniMax 返回非 JSON → toast「AI 解析失败...」
15. 录音不说话 → 模型 transcript 接近空 → toast「没有识别到内容,请重录」
16. 录音超过 60s → 自动停止 + 触发上传(不强制让用户点)

### 回归

17. R2.6 移动端 GPS 灰显 + 省市下拉(不退化)
18. 桌面端 VisitFormModal 正常(不退化)
19. 桌面端拜访清单 / 大盘地图(不退化)

---

## Out of scope(明确不做)

- 不做"视觉标识"(语音填的字段不打蓝色边框/角标)
- 不做"假阶段进度"(只一个 spin)
- 不做实时流式返回(等 MiniMax 一次性返回)
- 不做录音音频回放(用户不需要听录音)
- 不做提示词版本管理(后端写死,迭代时改代码即可)
- 不做 token 用量监控(后续如果烧太凶再加)
- 不做"语音填字段视觉标识"(YAGNI)
- 不在桌面端启用语音(只移动端)

---

## 预估

| 部分 | 时长 |
|---|---|
| 后端 voice 模块(controller + service + 提示词 + axios + 错误处理 + 单测) | ~3 小时 |
| 前端 `<VoiceRecorderButton />`(MediaRecorder + 状态机 + 倒计时 + 错误) | ~3 小时 |
| 前端集成进 `MobileVisitNewPage.tsx`(setFieldsValue + 横幅) | ~1 小时 |
| 边界场景 3 个修补(null filter + 强弱标签提示词 + 黄色横幅) | ~1 小时 |
| 联调 + 真机测试 + 回归 | ~1 小时 |
| **共** | **~9 小时** |

---

## 复用 / 注意事项

- **复用桌面端 `fetchCities` 模式**(已在 R2.6 移植到移动端)
- **复用 antd Spin / Alert / message** —— 不引新 UI 库
- **复用 axios**(后端已有)调 MiniMax API
- **复用 NestJS Multer**(检查 main.ts 是否已配,没配要加 `@nestjs/platform-express` 的 Multer middleware)
- **MINIMAX_API_KEY 仅在服务器 .env**,代码里不出现
- **错误日志脱敏**:转写文本可能含敏感信息,后端 logger 不要打印 audio base64 + transcript 全文,只记 token 用量 / 状态码 / 错误 type
- **iOS Safari 录音兼容性**:MediaRecorder + webm 在 iOS 14+ 才支持,iOS 13 及以下不能用 —— 检测 + 友好降级提示
