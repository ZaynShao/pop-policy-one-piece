import type { Visit, VisitStatus } from '@pop/shared-types';
import { authHeaders } from '@/lib/api';

interface FetchOpts {
  status?: VisitStatus | 'all';
  withDeleted?: boolean;
}

export async function fetchVisits(opts?: FetchOpts): Promise<{ data: Visit[] }> {
  const params = new URLSearchParams();
  if (opts?.status && opts.status !== 'all') params.set('status', opts.status);
  if (opts?.withDeleted) params.set('withDeleted', 'true');
  const q = params.toString() ? `?${params.toString()}` : '';
  const r = await fetch(`/api/v1/visits${q}`, { headers: authHeaders() });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? 'visits fetch fail');
  }
  return r.json();
}

export async function deleteVisit(id: string): Promise<void> {
  const r = await fetch(`/api/v1/visits/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? 'delete fail');
  }
}

export async function restoreVisit(id: string): Promise<Visit> {
  const r = await fetch(`/api/v1/visits/${id}/restore`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? 'restore fail');
  }
  const j = await r.json();
  return j.data;
}
