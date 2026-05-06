import type { Policy, PolicyDistribution, PolicyLevel } from '@pop/shared-types';
import { authHeaders } from '@/lib/api';

async function jsonOrThrow<T>(r: Response, fallbackMsg: string): Promise<T> {
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? fallbackMsg);
  }
  return r.json();
}

export async function fetchPolicyTopics(): Promise<{ data: string[] }> {
  const r = await fetch('/api/v1/policies/topics', { headers: authHeaders() });
  return jsonOrThrow(r, 'topics fetch fail');
}

export async function fetchPolicyDistribution(topic: string): Promise<{ data: PolicyDistribution }> {
  const r = await fetch(`/api/v1/policies/distribution?topic=${encodeURIComponent(topic)}`, {
    headers: authHeaders(),
  });
  return jsonOrThrow(r, 'distribution fetch fail');
}

export interface ListPoliciesParams {
  topic: string;
  provinceCode?: string;
  cityName?: string;
  level?: PolicyLevel;
}

export async function fetchPolicies(p: ListPoliciesParams): Promise<{ data: Policy[] }> {
  const qs = new URLSearchParams({ topic: p.topic });
  if (p.provinceCode) qs.set('provinceCode', p.provinceCode);
  if (p.cityName) qs.set('cityName', p.cityName);
  if (p.level) qs.set('level', p.level);
  const r = await fetch(`/api/v1/policies?${qs}`, { headers: authHeaders() });
  return jsonOrThrow(r, 'policies fetch fail');
}
