import type {
  GovOrg,
  CreateGovOrgInput,
  UpdateGovOrgInput,
  GovOrgListQuery,
} from '@pop/shared-types';
import { authHeaders } from '@/lib/api';

export async function fetchGovOrgs(q?: GovOrgListQuery): Promise<{ data: GovOrg[] }> {
  const params = new URLSearchParams();
  if (q?.provinceCode) params.set('provinceCode', q.provinceCode);
  if (q?.cityName) params.set('cityName', q.cityName);
  if (q?.level) params.set('level', q.level);
  if (q?.search) params.set('search', q.search);
  if (q?.withDeleted) params.set('withDeleted', 'true');
  if (q?.limit) params.set('limit', String(q.limit));
  const qs = params.toString() ? `?${params.toString()}` : '';
  const r = await fetch(`/api/v1/gov-orgs${qs}`, { headers: authHeaders() });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? 'gov-orgs fetch fail');
  }
  return r.json();
}

export async function fetchGovOrg(id: string): Promise<GovOrg> {
  const r = await fetch(`/api/v1/gov-orgs/${id}`, { headers: authHeaders() });
  if (!r.ok) throw new Error('gov-org fetch fail');
  const j = await r.json();
  return j.data;
}

export async function createGovOrg(input: CreateGovOrgInput): Promise<GovOrg> {
  const r = await fetch('/api/v1/gov-orgs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? 'gov-org create fail');
  }
  const j = await r.json();
  return j.data;
}

export async function updateGovOrg(id: string, input: UpdateGovOrgInput): Promise<GovOrg> {
  const r = await fetch(`/api/v1/gov-orgs/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? 'gov-org update fail');
  }
  const j = await r.json();
  return j.data;
}

export async function deleteGovOrg(id: string): Promise<void> {
  const r = await fetch(`/api/v1/gov-orgs/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!r.ok) throw new Error('gov-org delete fail');
}
