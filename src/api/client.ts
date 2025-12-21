import axios, { AxiosError, AxiosHeaders } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../utils/config';

// ЕДИНЫЕ ключи (должны совпадать с AuthContext)
export const TOKEN_KEY = 'clarity_token';
export const USERNAME_KEY = 'clarity_username';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

// Подставляем токен в каждый запрос (axios v1-safe)
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);

  if (token) {
    // axios v1: headers может быть AxiosHeaders или обычным объектом
    if (config.headers instanceof AxiosHeaders) {
      config.headers.set('Authorization', `Bearer ${token}`);
    } else {
      config.headers = config.headers ?? {};
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
  }

  return config;
});

export function getApiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const e = err as AxiosError<any>;

    // нет ответа (не тот IP/порт/сервер недоступен/HTTP блокируется)
    if (!e.response) {
      return `Нет ответа от сервера (Network Error). Проверь API_BASE_URL: ${API_BASE_URL}`;
    }

    const status = e.response.status;
    const data: any = e.response.data;

    // FastAPI часто возвращает { detail: ... }
    const detail = data?.detail ?? data?.message ?? data?.error;

    if (Array.isArray(detail)) {
      // 422: массив ошибок валидации
      const msgs = detail.map((d: any) => d?.msg ?? JSON.stringify(d)).join('\n');
      return `HTTP ${status}: ${msgs}`;
    }

    if (detail) return `HTTP ${status}: ${String(detail)}`;

    if (typeof data === 'string') return `HTTP ${status}: ${data}`;

    return `HTTP ${status}: ${JSON.stringify(data)}`;
  }

  if (err instanceof Error) return err.message;
  return String(err);
}

export function toFriendlyError(err: unknown): string {
  return getApiErrorMessage(err);
}
