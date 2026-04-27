import type { Comment, CreateCommentInput } from '@pop/shared-types';
import { authHeaders } from '@/lib/api';

export async function fetchPinComments(pinId: string): Promise<{ data: Comment[] }> {
  const r = await fetch(`/api/v1/pins/${pinId}/comments`, { headers: authHeaders() });
  if (!r.ok) throw new Error('comments fetch fail');
  return r.json();
}

export async function postPinComment(pinId: string, input: CreateCommentInput): Promise<Comment> {
  const r = await fetch(`/api/v1/pins/${pinId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  if (!r.ok) throw new Error('comment post fail');
  return r.json();
}
