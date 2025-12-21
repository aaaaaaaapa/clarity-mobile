import { api } from './client';
import type { Pin, PinCreate } from '../types/api';

export async function getPins(skip = 0, limit = 100): Promise<Pin[]> {
  const res = await api.get<Pin[]>('/pins/', { params: { skip, limit } });
  return res.data;
}

export async function createPin(payload: PinCreate): Promise<Pin> {
  const res = await api.post<Pin>('/pins/', payload);
  return res.data;
}
