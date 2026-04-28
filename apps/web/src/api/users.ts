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

export async function updateProfile(displayName: string): Promise<{ id: string; username: string; displayName: string; email: string }> {
  const r = await fetch('/api/v1/users/me', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ displayName }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? 'update profile fail');
  }
  return (await r.json()).data;
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  const r = await fetch('/api/v1/users/me/password', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ oldPassword, newPassword }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? 'change password fail');
  }
}
