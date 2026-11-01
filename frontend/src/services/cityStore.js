import { apiClient } from './apiClient.js';

const KEY = 'hz_city_id';
let citiesCache = null;

export function getCityId() {
  try {
    const v = parseInt(localStorage.getItem(KEY) || '1', 10);
    return Number.isFinite(v) && v > 0 ? v : 1;
  } catch { return 1; }
}
export function setCityId(id) {
  try { localStorage.setItem(KEY, String(id)); } catch {}
}
export async function getCities() {
  if (citiesCache) return citiesCache;
  try {
    const r = await apiClient.get('/cities');
    citiesCache = r.data;
  } catch { citiesCache = [{ id: 1, name: 'Vadodara' }]; }
  return citiesCache;
}
export function cityQuery() {
  return `city_id=${getCityId()}`;
}
