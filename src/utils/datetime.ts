/**
 * Утилиты для безопасного парсинга и форматирования даты/времени.
 * Без внешних библиотек.
 */

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

export function parseDateTime(input: unknown): Date | null {
  if (input == null) return null;

  // unix timestamp
  if (typeof input === 'number' && Number.isFinite(input)) {
    // если похоже на секунды (10 цифр) — конвертим в мс
    const ms = input < 1_000_000_000_000 ? input * 1000 : input;
    const d = new Date(ms);
    return Number.isFinite(d.getTime()) ? d : null;
  }

  if (typeof input === 'string') {
    const raw = input.trim();
    if (!raw) return null;

    // 1) пробуем как есть
    let d = new Date(raw);
    if (Number.isFinite(d.getTime())) return d;

    // 2) часто прилетает "YYYY-MM-DD HH:mm:ss" — заменим пробел на "T"
    if (raw.includes(' ') && !raw.includes('T')) {
      d = new Date(raw.replace(' ', 'T'));
      if (Number.isFinite(d.getTime())) return d;
    }

    // 3) иногда timestamp строкой
    const asNum = Number(raw);
    if (Number.isFinite(asNum)) return parseDateTime(asNum);
  }

  return null;
}

export function formatDateTimeRU(d: Date): string {
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  const hh = pad2(d.getHours());
  const min = pad2(d.getMinutes());
  return `${dd}.${mm}.${yyyy} ${hh}:${min}`;
}

/**
 * Достаём дату создания из разных возможных названий поля.
 */
export function formatPinCreatedAt(pin: any): string | null {
  const raw =
    pin?.created_at ??
    pin?.createdAt ??
    pin?.created ??
    pin?.created_time ??
    pin?.createdTime ??
    null;

  const d = parseDateTime(raw);
  return d ? formatDateTimeRU(d) : null;
}
