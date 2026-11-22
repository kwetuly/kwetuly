// Identifier encryption for the `identifiers` Edge Function (security review M3).
// Pure Web Crypto, no Deno APIs, so packages/shared tests can run it under Node.
//
// Cipher value (stored as bytea):  version (1 byte) || nonce (12 random bytes) || AES-256-GCM ciphertext || tag (16 bytes)
// Associated data:                 "{subject id}|{field}"  (a value copied to another row or column fails to open)
// Hash (duplicate flag):           HMAC-SHA256(hmac key of `hmacVersion`, hmacInput from identifier-formats)
//
// Keys: 32 random bytes each, base64, never in the database, the app or Vault.

export type KeyRing = {
  encKeys: Map<number, CryptoKey>;
  encActive: number;
  hmacKeys: Map<number, CryptoKey>;
  hmacActive: number;
};

const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const enc = new TextEncoder();

export class CryptoConfigError extends Error {}
export class DecryptError extends Error {
  constructor() {
    super('decrypt_failed'); // generic on purpose
  }
}

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64.trim());
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function b64Decode(b64: string): Uint8Array<ArrayBuffer> {
  return b64ToBytes(b64);
}

/**
 * Builds the key ring from environment values: IDENTIFIER_ENC_KEY_V{n}, IDENTIFIER_ENC_KEY_ACTIVE,
 * IDENTIFIER_HMAC_KEY_V{n}, IDENTIFIER_HMAC_KEY_ACTIVE. Throws CryptoConfigError if anything is
 * missing or not 32 bytes, so the function fails closed.
 */
export async function loadKeyRing(get: (name: string) => string | undefined): Promise<KeyRing> {
  const encActive = Number(get('IDENTIFIER_ENC_KEY_ACTIVE'));
  const hmacActive = Number(get('IDENTIFIER_HMAC_KEY_ACTIVE'));
  if (!Number.isInteger(encActive) || encActive < 1 || encActive > 255) throw new CryptoConfigError('enc_active');
  if (!Number.isInteger(hmacActive) || hmacActive < 1 || hmacActive > 255) throw new CryptoConfigError('hmac_active');
  const encKeys = new Map<number, CryptoKey>();
  const hmacKeys = new Map<number, CryptoKey>();
  for (let v = 1; v <= 255; v++) {
    const e = get(`IDENTIFIER_ENC_KEY_V${v}`);
    if (e) {
      const raw = b64ToBytes(e);
      if (raw.length !== 32) throw new CryptoConfigError(`enc_v${v}_length`);
      encKeys.set(v, await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']));
    }
    const h = get(`IDENTIFIER_HMAC_KEY_V${v}`);
    if (h) {
      const raw = b64ToBytes(h);
      if (raw.length !== 32) throw new CryptoConfigError(`hmac_v${v}_length`);
      hmacKeys.set(v, await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']));
    }
  }
  if (!encKeys.has(encActive)) throw new CryptoConfigError('enc_active_missing');
  if (!hmacKeys.has(hmacActive)) throw new CryptoConfigError('hmac_active_missing');
  return { encKeys, encActive, hmacKeys, hmacActive };
}

const aad = (subjectId: string, field: string) => enc.encode(`${subjectId}|${field}`);

/** Encrypts with the active key and a fresh random nonce. */
export async function encryptIdentifier(ring: KeyRing, subjectId: string, field: string, value: string): Promise<Uint8Array> {
  const key = ring.encKeys.get(ring.encActive);
  if (!key) throw new CryptoConfigError('enc_active_missing');
  const nonce = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(NONCE_BYTES)));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: aad(subjectId, field), tagLength: 128 }, key, enc.encode(value)),
  );
  const out = new Uint8Array(1 + NONCE_BYTES + sealed.length);
  out[0] = ring.encActive;
  out.set(nonce, 1);
  out.set(sealed, 1 + NONCE_BYTES);
  return out;
}

/** Opens a value with the key named by its first byte. Any failure is the same DecryptError. */
export async function decryptIdentifier(ring: KeyRing, subjectId: string, field: string, cipher: Uint8Array): Promise<string> {
  if (cipher.length < 1 + NONCE_BYTES + TAG_BYTES + 1) throw new DecryptError();
  const key = ring.encKeys.get(cipher[0]);
  if (!key) throw new DecryptError();
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: cipher.slice(1, 1 + NONCE_BYTES), additionalData: aad(subjectId, field), tagLength: 128 },
      key,
      cipher.slice(1 + NONCE_BYTES),
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new DecryptError();
  }
}

/** HMAC-SHA256 of the normalised input under the active HMAC key; returns the hash and its version. */
export async function hashIdentifier(ring: KeyRing, hmacInput: string): Promise<{ hash: Uint8Array; version: number }> {
  const key = ring.hmacKeys.get(ring.hmacActive);
  if (!key) throw new CryptoConfigError('hmac_active_missing');
  const hash = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(hmacInput)));
  return { hash, version: ring.hmacActive };
}
