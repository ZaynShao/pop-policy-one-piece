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
