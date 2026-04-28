import type { CreateUserInput, UpdateUserInput, UserRoleCode } from '@pop/shared-types';
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

export async function createUser(input: CreateUserInput): Promise<UserListItem> {
  const r = await fetch('/api/v1/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? 'create fail');
  }
  return (await r.json()).data;
}

export async function updateUserById(id: string, input: UpdateUserInput): Promise<UserListItem> {
  const r = await fetch(`/api/v1/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? 'update fail');
  }
  return (await r.json()).data;
}

export async function resetUserPassword(id: string, newPassword: string): Promise<void> {
  const r = await fetch(`/api/v1/users/${id}/password`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ newPassword }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? 'reset password fail');
  }
}

export async function changeUserRole(id: string, roleCode: UserRoleCode): Promise<void> {
  const r = await fetch(`/api/v1/users/${id}/role`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ roleCode }),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? 'change role fail');
  }
}

export async function deleteUser(id: string): Promise<void> {
  const r = await fetch(`/api/v1/users/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? 'delete fail');
  }
}

export async function restoreUser(id: string): Promise<UserListItem> {
  const r = await fetch(`/api/v1/users/${id}/restore`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? 'restore fail');
  }
  return (await r.json()).data;
}
