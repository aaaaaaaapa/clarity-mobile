export type TokenResponse = {
  access_token: string;
  token_type: 'bearer' | string;
};

export type User = {
  id: number;
  phone_number: string;
  email?: string | null;
  username?: string | null;
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
};

export type PinCreate = Omit<Pin, 'id'>;
