import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../utils/config';
import { api, getApiErrorMessage, TOKEN_KEY, USERNAME_KEY } from '../api/client';

type User = {
  id: number;
  username: string;
  email?: string | null;
  phone_number?: string | null;
  role_id?: number;
};

type RegisterPayload = {
  phone_number: string;
  email?: string | null;
  username: string;
  password: string;
};

type AuthContextValue = {
  token: string | null;
  username: string | null;
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  register: (data: RegisterPayload) => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  // восстановление сессии
  useEffect(() => {
    (async () => {
      const t = await AsyncStorage.getItem(TOKEN_KEY);
      const u = await AsyncStorage.getItem(USERNAME_KEY);
      setToken(t);
      setUsername(u);

      // чтобы axios сразу знал токен (до первого запроса)
      if (t) api.defaults.headers.common.Authorization = `Bearer ${t}`;
    })();
  }, []);

  const refreshUser = async () => {
    if (!username) return;
    try {
      const res = await api.get<User>('/users/username', { params: { username } });
      setUser(res.data);
    } catch (e) {
      console.log('refreshUser error', e);
    }
  };

  // подтягиваем профиль при наличии token+username
  useEffect(() => {
    if (token && username) refreshUser();
    if (!token) setUser(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, username]);

  const login = async (userName: string, password: string) => {
    const body = new URLSearchParams();
    body.append('username', userName);
    body.append('password', password);

    const res = await fetch(`${API_BASE_URL}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      throw new Error(await res.text());
    }

    const json = await res.json();
    const accessToken = json.access_token as string;

    await AsyncStorage.setItem(TOKEN_KEY, accessToken);
    await AsyncStorage.setItem(USERNAME_KEY, userName);

    api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;

    setToken(accessToken);
    setUsername(userName);
  };

  const register = async (data: RegisterPayload) => {
    try {
      const payload: any = { ...data };
      if (!payload.email) delete payload.email; // не шлём null/пустое

      await api.post('/auth/register', payload);
    } catch (e) {
      const msg = getApiErrorMessage(e);
      console.log('REGISTER ERROR:', msg, 'payload=', data);
      throw new Error(msg);
    }
  };

  const logout = async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, USERNAME_KEY]);
    delete api.defaults.headers.common.Authorization;

    setToken(null);
    setUsername(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({ token, username, user, login, register, refreshUser, logout }),
    [token, username, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
