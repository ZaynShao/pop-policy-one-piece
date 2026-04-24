export interface HealthDto {
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  timestamp: string;
}
