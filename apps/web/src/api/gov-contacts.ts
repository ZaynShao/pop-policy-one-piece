import type {
  GovContact,
  CreateGovContactInput,
  UpdateGovContactInput,
  GovContactListQuery,
} from '@pop/shared-types';
import { authHeaders } from '@/lib/api';

export async function fetchGovContacts(q?: GovContactListQuery): Promise<{ data: GovContact[] }> {
  const params = new URLSearchParams();
  if (q?.orgId) params.set('orgId', q.orgId);
  if (q?.ownerUserId) params.set('ownerUserId', q.ownerUserId);
  if (q?.tier) params.set('tier', q.tier);
  if (q?.search) params.set('search', q.search);
  if (q?.limit) params.set('limit', String(q.limit));
  const qs = params.toString() ? `?${params.toString()}` : '';
  const r = await fetch(`/api/v1/gov-contacts${qs}`, { headers: authHeaders() });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? 'gov-contacts fetch fail');
  }
  return r.json();
}

export async function createGovContact(input: CreateGovContactInput): Promise<GovContact> {
  const r = await fetch('/api/v1/gov-contacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? 'gov-contact create fail');
  }
  const j = await r.json();
  return j.data;
}

export async function updateGovContact(id: string, input: UpdateGovContactInput): Promise<GovContact> {
  const r = await fetch(`/api/v1/gov-contacts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? 'gov-contact update fail');
  }
  const j = await r.json();
  return j.data;
}

export async function deleteGovContact(id: string): Promise<void> {
  const r = await fetch(`/api/v1/gov-contacts/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!r.ok) throw new Error('gov-contact delete fail');
}
