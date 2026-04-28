import type {
  Theme,
  ThemeCoverage,
  ThemeWithCoverage,
  ThemeByRegionResult,
  CreateThemeInput,
  UpdateThemeInput,
  ThemeStatus,
} from '@pop/shared-types';
import { authHeaders } from '@/lib/api';

async function jsonOrThrow<T>(r: Response, fallbackMsg: string): Promise<T> {
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? fallbackMsg);
  }
  return r.json();
}

export async function fetchThemes(opts?: { status?: ThemeStatus | 'all' }): Promise<{ data: Theme[] }> {
  const q = opts?.status ? `?status=${opts.status}` : '';
  const r = await fetch(`/api/v1/themes${q}`, { headers: authHeaders() });
  return jsonOrThrow(r, 'themes fetch fail');
}

export async function fetchTheme(id: string): Promise<{ data: ThemeWithCoverage }> {
  const r = await fetch(`/api/v1/themes/${id}`, { headers: authHeaders() });
  return jsonOrThrow(r, 'theme fetch fail');
}

/**
 * B7-B9 反查 — 给 region 拉所有 cover 该 region 的已发布主题
 * selectedIds 可选,Q2=X 实现:只显示当前涂层涉及的主题
 */
export async function fetchThemesByRegion(
  regionCode: string,
  selectedIds?: string[],
): Promise<{ data: ThemeByRegionResult[] }> {
  const params = new URLSearchParams({ regionCode });
  if (selectedIds && selectedIds.length > 0) {
    params.set('selectedIds', selectedIds.join(','));
  }
  const r = await fetch(`/api/v1/themes/by-region?${params.toString()}`, {
    headers: authHeaders(),
  });
  return jsonOrThrow(r, 'themes by-region fetch fail');
}

export async function postTheme(input: CreateThemeInput): Promise<Theme> {
  const r = await fetch(`/api/v1/themes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  const j = await jsonOrThrow<{ data: Theme }>(r, 'theme create fail');
  return j.data;
}

export async function putTheme(id: string, input: UpdateThemeInput): Promise<Theme> {
  const r = await fetch(`/api/v1/themes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(input),
  });
  const j = await jsonOrThrow<{ data: Theme }>(r, 'theme update fail');
  return j.data;
}

export async function fetchCoverage(id: string): Promise<ThemeCoverage[]> {
  const r = await fetch(`/api/v1/themes/${id}/fetch-coverage`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const j = await jsonOrThrow<{ data: ThemeCoverage[] }>(r, 'fetch coverage fail');
  return j.data;
}

export async function publishTheme(id: string): Promise<Theme> {
  const r = await fetch(`/api/v1/themes/${id}/publish`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const j = await jsonOrThrow<{ data: Theme }>(r, 'publish fail');
  return j.data;
}

export async function archiveTheme(id: string): Promise<Theme> {
  const r = await fetch(`/api/v1/themes/${id}/archive`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const j = await jsonOrThrow<{ data: Theme }>(r, 'archive fail');
  return j.data;
}

export async function unarchiveTheme(id: string): Promise<Theme> {
  const r = await fetch(`/api/v1/themes/${id}/unarchive`, {
    method: 'POST',
    headers: authHeaders(),
  });
  const j = await jsonOrThrow<{ data: Theme }>(r, 'unarchive fail');
  return j.data;
}
