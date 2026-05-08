export interface MockInvokeRequestDto {
  regionCode: string;
  themeCode?: string;
  configKey?: string;
}

export interface MockInvokeResponseDto {
  downloadUrl: string;
  summary: string;
  params: Record<string, string>;
  generatedAt: string;
}
