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
  photo_link: string;
  description?: string | null;

  // Server-side meta (admin can change status)
  category_id: string;
  status_id: string;
};

export type PinCreate = Omit<Pin, 'id'>;

export type PinUpdate = Partial<PinCreate>;
