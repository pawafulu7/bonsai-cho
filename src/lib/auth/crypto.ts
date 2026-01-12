/**
 * Cryptographic utilities for OAuth authentication
 *
 * Uses Web Crypto API for Cloudflare Workers compatibility.
 * No Node.js crypto or Buffer usage.
 */

/**
 * Convert Uint8Array to base64url string
 */
export function base64urlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Convert base64url string to Uint8Array
 */
export function base64urlDecode(str: string): Uint8Array {
  // Add padding if necessary
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Generate cryptographically secure random bytes
 */
export function generateRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Generate a random state parameter for OAuth
 * Returns a 32-byte (256-bit) base64url-encoded string
 */
export function generateState(): string {
  return base64urlEncode(generateRandomBytes(32));
}

/**
 * Generate a PKCE code verifier
 * Returns a 32-byte (256-bit) base64url-encoded string
 */
export function generateCodeVerifier(): string {
  return base64urlEncode(generateRandomBytes(32));
}

/**
 * Generate a nonce for Google OIDC
 * Returns a 16-byte (128-bit) base64url-encoded string
 */
export function generateNonce(): string {
  return base64urlEncode(generateRandomBytes(16));
}

/**
 * Generate a PKCE code challenge from a code verifier using S256 method
 */
export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64urlEncode(new Uint8Array(hash));
}

/**
 * Hash a string using SHA-256
 * Used for hashing session tokens before storage
 */
export async function sha256Hash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64urlEncode(new Uint8Array(hash));
}

/**
 * Derive an encryption key from a secret using HKDF
 */
async function deriveKey(
  secret: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    "HKDF",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: salt.buffer as ArrayBuffer,
      info: encoder.encode("bonsai-oauth"),
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypt data using AES-GCM with HKDF key derivation
 *
 * Format: base64url(salt[16] || iv[12] || ciphertext)
 */
export async function encrypt(
  plaintext: string,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const salt = generateRandomBytes(16);
  const iv = generateRandomBytes(12);
  const key = await deriveKey(secret, salt);

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
    key,
    encoder.encode(plaintext)
  );

  // Combine: salt (16) + iv (12) + ciphertext
  const result = new Uint8Array(
    salt.length + iv.length + encrypted.byteLength
  );
  result.set(salt, 0);
  result.set(iv, salt.length);
  result.set(new Uint8Array(encrypted), salt.length + iv.length);

  return base64urlEncode(result);
}

/**
 * Decrypt data encrypted with the encrypt() function
 */
export async function decrypt(
  ciphertext: string,
  secret: string
): Promise<string> {
  const data = base64urlDecode(ciphertext);

  // Extract components
  const salt = data.slice(0, 16);
  const iv = data.slice(16, 28);
  const encrypted = data.slice(28);

  const key = await deriveKey(secret, salt);

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer },
    key,
    encrypted.buffer.slice(encrypted.byteOffset, encrypted.byteOffset + encrypted.byteLength) as ArrayBuffer
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Generate a session ID
 * Returns a 32-byte (256-bit) base64url-encoded string
 */
export function generateSessionId(): string {
  return base64urlEncode(generateRandomBytes(32));
}

/**
 * Generate a unique ID for database records
 * Returns a 16-byte (128-bit) base64url-encoded string
 */
export function generateId(): string {
  return base64urlEncode(generateRandomBytes(16));
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
