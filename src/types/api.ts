export type TokenResponse = {
  access_token: string;
  token_type: 'bearer' | string;
};

export type User = {
  id: number;
  phone_number: string;
  email?: string | null;
  username?: string | null;
  role_id?: number | null;
};

export type UserCreate = {
  phone_number: string;
  email?: string | null;
  username: string;
  password: string;
};

export type Pin = {
  id: number;
  /**
   * В бэке поля называются x/y.
   * В приложении считаем: x = longitude, y = latitude.
   */
  x: number;
  y: number;
  photo_link: string | null;
  description?: string | null;

  // Server-side meta (admin can change status)
  category_id: string;
  status_id: string;

  /**
   * Кто создал заявку.
   * В разных версиях бэка поле может называться по-разному, поэтому в UI
   * читаем его гибко (owner_id / user_id / ...).
   */
  owner_id?: number | null;
  user_id?: number | null;

  /**
   * Дата/время создания заявки (если бэк отдаёт).
   * Обычно ISO-строка, но иногда может быть unix timestamp.
   */
  created_at?: string | number | null;
};

export type PinCreate = {
  x: number;
  y: number;
  photo_link: string | null;
  description?: string | null;
  category_id?: string;
  status_id?: string;
};

export type PinUpdate = Partial<PinCreate>;
