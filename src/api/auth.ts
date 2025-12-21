import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, TOKEN_KEY, USERNAME_KEY } from './client';
import type { TokenResponse, UserCreate } from '../types/api';

export async function login(username: string, password: string): Promise<string> {
  // FastAPI OAuth2PasswordRequestForm ожидает application/x-www-form-urlencoded
  const body = new URLSearchParams();
  body.append('username', username);
  body.append('password', password);

  const { data } = await api.post<TokenResponse>('/auth/token', body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  await AsyncStorage.setItem(TOKEN_KEY, data.access_token);
  await AsyncStorage.setItem(USERNAME_KEY, username);
  return data.access_token;
}

export async function register(payload: UserCreate): Promise<void> {
  await api.post('/auth/register', payload);
}

export async function logout(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, USERNAME_KEY]);
}
