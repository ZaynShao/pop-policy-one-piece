import type { UserRoleCode } from '@pop/shared-types';
import { authHeaders } from '@/lib/api';

export interface UserListItem {
  id: string;
  username: string;
  displayName: string;
  roleCode: UserRoleCode | null;
}

export async function fetchUsers(): Promise<{ data: UserListItem[] }> {
  const r = await fetch('/api/v1/users', { headers: authHeaders() });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? 'users fetch fail');
  }
  return r.json();
}
