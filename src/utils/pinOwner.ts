/**
 * Разные версии бэка могут по‑разному называть поле владельца заявки.
 * В UI читаем гибко.
 */
export function getPinOwnerId(pin: any): number | null {
  const raw =
    pin?.owner_id ??
    pin?.ownerId ??
    pin?.user_id ??
    pin?.userId ??
    pin?.created_by ??
    pin?.creator_id ??
    pin?.createdBy ??
    null;

  const num = typeof raw === 'string' ? Number(raw) : raw;
  return Number.isFinite(num) ? Number(num) : null;
}
