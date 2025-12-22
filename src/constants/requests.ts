export type RequestCategoryId =
  | 'trash'
  | 'dump'
  | 'overflow_bin'
  | 'dirty_road'
  | 'graffiti'
  | 'other';

export type RequestStatusId = 'new' | 'in_progress' | 'done' | 'rejected';

export type RequestCategory = {
  id: RequestCategoryId;
  title: string;
  emoji: string;
};

export type RequestStatus = {
  id: RequestStatusId;
  title: string;
  // Цвет задаём кодом, чтобы не тянуть сторонние библиотеки
  color: string;
};

export const CATEGORIES: RequestCategory[] = [
  { id: 'trash', title: 'Мусор', emoji: '🗑️' },
  { id: 'dump', title: 'Свалка', emoji: '🏚️' },
  { id: 'overflow_bin', title: 'Переполненная урна', emoji: '🧺' },
  { id: 'dirty_road', title: 'Грязь/разлив', emoji: '💧' },
  { id: 'graffiti', title: 'Граффити', emoji: '🎨' },
  { id: 'other', title: 'Другое', emoji: '❓' },
];

export const STATUSES: RequestStatus[] = [
  { id: 'new', title: 'Новая', color: '#0f172a' },
  { id: 'in_progress', title: 'В работе', color: '#92400e' },
  { id: 'done', title: 'Решено', color: '#166534' },
  { id: 'rejected', title: 'Отклонено', color: '#7f1d1d' },
];

export function categoryById(id: RequestCategoryId | null | undefined) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

export function statusById(id: RequestStatusId | null | undefined) {
  return STATUSES.find((s) => s.id === id) ?? STATUSES[0];
}
