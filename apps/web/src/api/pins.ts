import type { Pin } from '@pop/shared-types';
import { authHeaders } from '@/lib/api';

export async function fetchPins(opts?: { withDeleted?: boolean }): Promise<{ data: Pin[] }> {
  const q = opts?.withDeleted ? '?withDeleted=true' : '';
  const r = await fetch(`/api/v1/pins${q}`, { headers: authHeaders() });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? 'pins fetch fail');
  }
  return r.json();
}

export async function restorePin(id: string): Promise<Pin> {
  const r = await fetch(`/api/v1/pins/${id}/restore`, {
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
