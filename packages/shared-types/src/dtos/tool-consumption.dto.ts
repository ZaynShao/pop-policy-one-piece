import type { Tool } from './tool.dto';

export interface ToolConsumptionLog {
  id: string;
  toolId: string;
  consumerId: string;
  consumedAt: string;
  contextPinId: string | null;
  contextVisitId: string | null;
  contextRegionCode: string | null;
  interfaceResponse: Record<string, unknown> | null;
}

export interface ConsumptionLogWithTool extends ToolConsumptionLog {
  tool: Pick<Tool, 'id' | 'title' | 'type' | 'taxonomyTag'>;
}
