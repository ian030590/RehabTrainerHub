export const gameRunRequestMaximumBytes = 16 * 1024;
export const gameRunResultMaximumBytes = 16_000;
export const gameRunSessionRequestMaximumBytes = 1024;
export const gameRunSessionTokenBytes = 32;
export const gameRunSessionTtlSeconds = 24 * 60 * 60;

export function IsGameRunIdentifier(value) {
  return typeof value === 'string'
    && value.length >= 8
    && value.length <= 128
    && /^[A-Za-z0-9_-]+$/.test(value);
}

export function IsGameRunSessionToken(value) {
  return typeof value === 'string'
    && value.length === gameRunSessionTokenBytes * 2
    && /^[a-f0-9]+$/.test(value);
}

export function CreateGameRunSessionToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(gameRunSessionTokenBytes));
  return [...bytes]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function HashGameRunSessionToken(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function IsExactObject(value, requiredKeys, optionalKeys = []) {
  if (!IsPlainObject(value)) return false;
  const keys = Object.keys(value);
  const allowed = new Set([...requiredKeys, ...optionalKeys]);
  return requiredKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key))
    && keys.every((key) => allowed.has(key));
}

function IsPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
