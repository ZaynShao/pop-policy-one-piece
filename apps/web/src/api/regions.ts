import { authHeaders } from '@/lib/api';

export interface ReverseGeocodeResult {
  provinceCode: string;
  provinceName: string;
  cityName: string;
}

/** GPS 反查 → 最近 city */
export async function fetchReverseGeocode(
  lng: number,
  lat: number,
): Promise<ReverseGeocodeResult> {
  const r = await fetch(
    `/api/v1/regions/reverse?lng=${lng}&lat=${lat}`,
    { headers: authHeaders() },
  );
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.message ?? '反查失败');
  }
  const j = await r.json();
  return j.data;
}
