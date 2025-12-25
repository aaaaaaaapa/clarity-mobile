/**
 * Admin detection helper.
 *
 * Why so defensive?
 * - Different backends expose role info differently (role_id as number/string, role.name, is_admin, etc.)
 * - Some setups also encode role/scopes into JWT.
 *
 * IMPORTANT: This does NOT verify the JWT signature. It's only used to read claims
 * already provided by the backend for UI gating.
 */

type AnyUser = any;

function normalizeString(v: any): string {
  return String(v ?? '').trim();
}

function normalizeNumber(v: any): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = normalizeString(v);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// Minimal base64 decoder that works in RN/Expo without extra deps.
function base64Decode(base64: string): string {
  // Base64URL -> Base64
  let input = base64.replace(/-/g, '+').replace(/_/g, '/');
  // Pad
  while (input.length % 4 !== 0) input += '=';

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = '';
  let i = 0;

  for (; i < input.length; ) {
    const enc1 = chars.indexOf(input.charAt(i++));
    const enc2 = chars.indexOf(input.charAt(i++));
    const enc3 = chars.indexOf(input.charAt(i++));
    const enc4 = chars.indexOf(input.charAt(i++));

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    str += String.fromCharCode(chr1);
    if (enc3 !== 64) str += String.fromCharCode(chr2);
    if (enc4 !== 64) str += String.fromCharCode(chr3);
  }

  // Handle UTF-8
  try {
    // eslint-disable-next-line no-undef
    return decodeURIComponent(
      str
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
  } catch {
    return str;
  }
}

export function decodeJwtPayload(token?: string | null): any | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const json = base64Decode(parts[1]);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isAdminByText(value: any): boolean {
  const s = normalizeString(value).toLowerCase();
  if (!s) return false;
  return s === 'admin' || s === 'administrator' || s === 'админ' || s === 'администратор' || s.includes('admin');
}

/**
 * Returns true if user should be treated as admin in UI.
 */
export function isAdminUser(user?: AnyUser | null, token?: string | null): boolean {
  const u: AnyUser = user ?? {};

  // 1) Explicit boolean flags from backend
  if (u.is_admin === true || u.isAdmin === true || u.admin === true) return true;

  // 2) Text role fields on user
  if (isAdminByText(u.role) || isAdminByText(u.role_name) || isAdminByText(u?.role?.name)) return true;

  // 3) JWT claims (if present)
  const payload = decodeJwtPayload(token);
  if (payload) {
    if (payload.is_admin === true || payload.isAdmin === true || payload.admin === true) return true;
    if (isAdminByText(payload.role) || isAdminByText(payload.role_name) || isAdminByText(payload?.role?.name)) return true;

    const scopes = normalizeString(payload.scope || payload.scopes);
    if (scopes && /\badmin\b/i.test(scopes)) return true;
    if (Array.isArray(payload.roles) && payload.roles.some((r: any) => isAdminByText(r))) return true;
    if (Array.isArray(payload.permissions) && payload.permissions.some((p: any) => isAdminByText(p))) return true;
  }

  // 4) Numeric role id.
  // В вашем бэкенде администратор — это role_id=2.
  const roleId =
    normalizeNumber(u.role_id) ??
    normalizeNumber(u.roleId) ??
    normalizeNumber(u?.role?.id) ??
    (payload ? normalizeNumber(payload.role_id ?? payload.roleId ?? payload?.role?.id) : null);

  if (roleId === 2) return true;

  // 5) Fallback: many projects name admin accounts explicitly
  // (keeps security: doesn't accidentally make all users admin).
  const username = normalizeString(u.username).toLowerCase();
  if (username && /admin/.test(username)) return true;

  return false;
}
