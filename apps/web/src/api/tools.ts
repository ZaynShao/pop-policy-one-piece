import type { Tool, CreateToolRequestDto, UpdateToolRequestDto, ToolBinding,
  CreateBindingRequestDto, UploadUrlResponseDto, ConsumptionLogWithTool,
  MockInvokeResponseDto, ToolStatus, ToolType } from '@pop/shared-types';
import { authHeaders } from '@/lib/api';

const j = async (r: Response) => {
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message ?? 'tool api fail');
  return r.json();
};

export async function fetchTools(opts?: { status?: ToolStatus; type?: ToolType; creatorId?: string }) {
  const p = new URLSearchParams();
  if (opts?.status) p.set('status', opts.status);
  if (opts?.type) p.set('type', opts.type);
  if (opts?.creatorId) p.set('creatorId', opts.creatorId);
  const q = p.toString() ? `?${p}` : '';
  return j(await fetch(`/api/v1/tools${q}`, { headers: authHeaders() })) as Promise<{ data: Tool[] }>;
}

export async function createTool(dto: CreateToolRequestDto) {
  return j(await fetch('/api/v1/tools', {
    method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  })) as Promise<{ data: Tool }>;
}

export async function updateTool(id: string, dto: UpdateToolRequestDto) {
  return j(await fetch(`/api/v1/tools/${id}`, {
    method: 'PUT', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  })) as Promise<{ data: Tool }>;
}

export async function publishTool(id: string) { return j(await fetch(`/api/v1/tools/${id}/publish`, { method: 'POST', headers: authHeaders() })); }
export async function archiveTool(id: string) { return j(await fetch(`/api/v1/tools/${id}/archive`, { method: 'POST', headers: authHeaders() })); }
export async function restoreTool(id: string) { return j(await fetch(`/api/v1/tools/${id}/restore`, { method: 'POST', headers: authHeaders() })); }

export async function listBindings(toolId: string) {
  return j(await fetch(`/api/v1/tools/${toolId}/bindings`, { headers: authHeaders() })) as Promise<{ data: ToolBinding[] }>;
}
export async function addBinding(toolId: string, dto: CreateBindingRequestDto) {
  return j(await fetch(`/api/v1/tools/${toolId}/bindings`, {
    method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  }));
}
export async function deleteBinding(toolId: string, bindingId: string) {
  return j(await fetch(`/api/v1/tools/${toolId}/bindings/${bindingId}`, { method: 'DELETE', headers: authHeaders() }));
}

export async function getUploadUrl(filename: string, contentType: string) {
  return j(await fetch('/api/v1/tools/upload-url', {
    method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, contentType }),
  })) as Promise<{ data: UploadUrlResponseDto }>;
}

export async function fetchToolsByPoint(opts: { visitId?: string; pinId?: string }) {
  const p = new URLSearchParams();
  if (opts.visitId) p.set('visitId', opts.visitId);
  if (opts.pinId) p.set('pinId', opts.pinId);
  return j(await fetch(`/api/v1/tools/by-point?${p}`, { headers: authHeaders() })) as Promise<{ data: { groups: Record<string, Tool[]> } }>;
}

export async function downloadTool(toolId: string, ctx: { contextPinId?: string; contextVisitId?: string; contextRegionCode?: string }) {
  return j(await fetch(`/api/v1/tools/${toolId}/download`, {
    method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(ctx),
  })) as Promise<{ data: { fileUrl: string } }>;
}

export async function invokeTool(toolId: string, ctx: { contextPinId?: string; contextVisitId?: string; contextRegionCode?: string }) {
  return j(await fetch(`/api/v1/tools/${toolId}/invoke`, {
    method: 'POST', headers: { ...authHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(ctx),
  })) as Promise<{ data: { response: MockInvokeResponseDto } }>;
}

export async function fetchToolConsumptions(toolId: string) {
  return j(await fetch(`/api/v1/tools/${toolId}/consumptions`, { headers: authHeaders() }));
}

export async function fetchMyConsumptions(): Promise<{ data: ConsumptionLogWithTool[] }> {
  return j(await fetch('/api/v1/me/consumptions', { headers: authHeaders() }));
}
