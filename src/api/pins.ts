import { api, TOKEN_KEY } from './client';
import type { Pin, PinCreate } from '../types/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../utils/config';

export async function getPins(skip = 0, limit = 100): Promise<Pin[]> {
  const res = await api.get<Pin[]>('/pins/', { params: { skip, limit } });
  return res.data;
}

export async function createPin(payload: PinCreate): Promise<Pin> {
  const res = await api.post<Pin>('/pins/', payload);
  return res.data;
}

/**
 * Upload a photo as multipart/form-data and get a short link back.
 * Backend should expose: POST /pins/photo -> { photo_link: "/uploads/<file>" }
 *
 * IMPORTANT (React Native): do NOT set Content-Type manually for multipart.
 * If you set it yourself, boundary is missing and FastAPI returns 400.
 */
export async function uploadPinPhoto(photoUri: string): Promise<string> {
  const uri = (photoUri ?? '').trim();
  if (!uri) throw new Error('photoUri is empty');

  const name = uri.split('/').pop() ?? 'photo.jpg';
  const ext = (name.split('.').pop() ?? 'jpg').toLowerCase();

  const type =
    ext === 'png'
      ? 'image/png'
      : ext === 'webp'
        ? 'image/webp'
        : ext === 'heic' || ext === 'heif'
          ? 'image/heic'
          : 'image/jpeg';

  const form = new FormData();
  form.append('file', { uri, name, type } as any);

  // Берём токен, чтобы загрузка работала при включённой авторизации
  const token = await AsyncStorage.getItem(TOKEN_KEY);

  // Используем fetch для multipart — он гарантированно выставляет boundary
  const res = await fetch(`${API_BASE_URL}/pins/photo`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: 'application/json',
      // ❌ НЕ добавляй Content-Type сюда!
    },
    body: form as any,
  });

  // Читаем ответ максимально безопасно
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }

  if (!res.ok) {
    const detail = data?.detail ?? data?.message ?? text ?? `HTTP ${res.status}`;
    throw new Error(`HTTP ${res.status}: ${String(detail)}`);
  }

  const photo_link = data?.photo_link;
  if (!photo_link) throw new Error('Server did not return photo_link');
  return String(photo_link);
}

/**
 * Опциональные эндпоинты (могут отсутствовать на бэке).
 * Нужны для сценария «просмотр/редактирование заявки» из курсовой.
 */
export async function updatePin(id: number, payload: PinCreate): Promise<Pin> {
  const res = await api.put<Pin>(`/pins/${id}`, payload);
  return res.data;
}

export async function deletePin(id: number): Promise<void> {
  await api.delete(`/pins/${id}`);
}
