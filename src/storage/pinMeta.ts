import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RequestCategoryId, RequestStatusId } from '../constants/requests';

/**
 * В исходном бэкенде у Pin нет полей category/status.
 * Для курсовой (UI/UX) храним эти поля локально по id метки.
 */
export type PinMeta = {
  categoryId: RequestCategoryId;
  statusId: RequestStatusId;
  updatedAt: number; // unix ms
};

const KEY_PREFIX = 'clarity_pin_meta:';

function key(id: number) {
  return `${KEY_PREFIX}${id}`;
}

export async function getPinMeta(id: number): Promise<PinMeta | null> {
  const raw = await AsyncStorage.getItem(key(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PinMeta;
  } catch {
    return null;
  }
}

export async function setPinMeta(id: number, meta: PinMeta): Promise<void> {
  await AsyncStorage.setItem(key(id), JSON.stringify(meta));
}

export async function getManyPinMeta(ids: number[]): Promise<Record<number, PinMeta>> {
  if (ids.length === 0) return {};
  const pairs = await AsyncStorage.multiGet(ids.map((id) => key(id)));
  const out: Record<number, PinMeta> = {};
  for (const [k, v] of pairs) {
    if (!k || !v) continue;
    const idStr = k.replace(KEY_PREFIX, '');
    const id = Number(idStr);
    if (!Number.isFinite(id)) continue;
    try {
      out[id] = JSON.parse(v) as PinMeta;
    } catch {
      // ignore
    }
  }
  return out;
}

export function defaultPinMeta(): PinMeta {
  return { categoryId: 'other', statusId: 'new', updatedAt: Date.now() };
}
