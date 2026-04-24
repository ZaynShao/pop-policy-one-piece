export interface HealthDto {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  timestamp: string;
  /** 数据库连通性(V0.1 Week 1 后半段接入) */
  db?: 'ok' | 'down';
}
