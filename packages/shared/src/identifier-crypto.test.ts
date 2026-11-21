// Tests for the `identifiers` Edge Function's crypto (security review M3), run under Node's Web Crypto.
// Keys here are generated per run; no real key is ever in the repository.
import { describe, expect, it } from 'vitest';
import {
  bytesToB64,
  CryptoConfigError,
  DecryptError,
  decryptIdentifier,
  encryptIdentifier,
  hashIdentifier,
  loadKeyRing,
} from '../../../supabase/functions/identifiers/crypto';

const randomKey = () => bytesToB64(crypto.getRandomValues(new Uint8Array(32)));
const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

function envOf(values: Record<string, string>) {
  return (name: string) => values[name];
}

describe('identifier crypto', async () => {
  const v1 = randomKey();
  const h1 = randomKey();
  const ring = await loadKeyRing(envOf({
    IDENTIFIER_ENC_KEY_V1: v1, IDENTIFIER_ENC_KEY_ACTIVE: '1',
    IDENTIFIER_HMAC_KEY_V1: h1, IDENTIFIER_HMAC_KEY_ACTIVE: '1',
  }));

  it('round-trips and starts with the key version and a 12-byte nonce', async () => {
    const c = await encryptIdentifier(ring, USER_A, 'nida', '19900101123450000112');
    expect(c[0]).toBe(1);
    expect(c.length).toBe(1 + 12 + 20 + 16);
    expect(await decryptIdentifier(ring, USER_A, 'nida', c)).toBe('19900101123450000112');
  });

  it('uses a fresh nonce every time', async () => {
    const a = await encryptIdentifier(ring, USER_A, 'nida', '19900101123450000112');
    const b = await encryptIdentifier(ring, USER_A, 'nida', '19900101123450000112');
    expect(bytesToB64(a.slice(1, 13))).not.toBe(bytesToB64(b.slice(1, 13)));
  });

  it('refuses a value copied to another person or another field', async () => {
    const c = await encryptIdentifier(ring, USER_A, 'nida', '19900101123450000112');
    await expect(decryptIdentifier(ring, USER_B, 'nida', c)).rejects.toBeInstanceOf(DecryptError);
    await expect(decryptIdentifier(ring, USER_A, 'tin', c)).rejects.toBeInstanceOf(DecryptError);
  });

  it('fails closed on tampering, short values and unknown versions', async () => {
    const c = await encryptIdentifier(ring, USER_A, 'tin', '123456789');
    const flipped = c.slice();
    flipped[20] ^= 1;
    await expect(decryptIdentifier(ring, USER_A, 'tin', flipped)).rejects.toBeInstanceOf(DecryptError);
    await expect(decryptIdentifier(ring, USER_A, 'tin', c.slice(0, 20))).rejects.toBeInstanceOf(DecryptError);
    const v9 = c.slice();
    v9[0] = 9;
    await expect(decryptIdentifier(ring, USER_A, 'tin', v9)).rejects.toBeInstanceOf(DecryptError);
  });

  it('opens old values after rotation while writing with the new key', async () => {
    const old = await encryptIdentifier(ring, USER_A, 'passport', 'C01X00T47');
    const rotated = await loadKeyRing(envOf({
      IDENTIFIER_ENC_KEY_V1: v1, IDENTIFIER_ENC_KEY_V2: randomKey(), IDENTIFIER_ENC_KEY_ACTIVE: '2',
      IDENTIFIER_HMAC_KEY_V1: h1, IDENTIFIER_HMAC_KEY_ACTIVE: '1',
    }));
    expect(await decryptIdentifier(rotated, USER_A, 'passport', old)).toBe('C01X00T47');
    expect((await encryptIdentifier(rotated, USER_A, 'passport', 'C01X00T47'))[0]).toBe(2);
  });

  it('hashes the same input the same way, with its version', async () => {
    const a = await hashIdentifier(ring, 'passport|DE|C01X00T47');
    const b = await hashIdentifier(ring, 'passport|DE|C01X00T47');
    const c = await hashIdentifier(ring, 'passport|FR|C01X00T47');
    expect(a.version).toBe(1);
    expect(a.hash.length).toBe(32);
    expect(bytesToB64(a.hash)).toBe(bytesToB64(b.hash));
    expect(bytesToB64(a.hash)).not.toBe(bytesToB64(c.hash));
  });

  it('refuses missing or wrong-length keys', async () => {
    await expect(loadKeyRing(envOf({}))).rejects.toBeInstanceOf(CryptoConfigError);
    await expect(loadKeyRing(envOf({
      IDENTIFIER_ENC_KEY_V1: bytesToB64(new Uint8Array(16)), IDENTIFIER_ENC_KEY_ACTIVE: '1',
      IDENTIFIER_HMAC_KEY_V1: h1, IDENTIFIER_HMAC_KEY_ACTIVE: '1',
    }))).rejects.toBeInstanceOf(CryptoConfigError);
    await expect(loadKeyRing(envOf({
      IDENTIFIER_ENC_KEY_V1: v1, IDENTIFIER_ENC_KEY_ACTIVE: '2',
      IDENTIFIER_HMAC_KEY_V1: h1, IDENTIFIER_HMAC_KEY_ACTIVE: '1',
    }))).rejects.toBeInstanceOf(CryptoConfigError);
  });
});
