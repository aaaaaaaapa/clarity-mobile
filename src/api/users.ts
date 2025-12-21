import { api } from './client';
import type { User, UserCreate } from '../types/api';

export async function getUserByUsername(username: string): Promise<User> {
  const { data } = await api.get<User>('/users/username', { params: { username } });
  return data;
}

export async function updateUser(userId: number, payload: UserCreate): Promise<User> {
  const { data } = await api.put<User>(`/users/${userId}`, payload);
  return data;
}

export async function deleteUser(userId: number): Promise<void> {
  await api.delete(`/users/${userId}`);
}
