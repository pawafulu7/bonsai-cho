/**
 * Crypto utilities unit tests
 *
 * Tests for cryptographic functions used in OAuth authentication.
 * Uses Vitest with Node.js Web Crypto API.
 */

import { describe, expect, it } from "vitest";
import {
  base64urlDecode,
  base64urlEncode,
  decrypt,
  encrypt,
  generateCodeChallenge,
  generateCodeVerifier,
  generateId,
  generateNonce,
  generateRandomBytes,
  generateSessionId,
  generateState,
  secureCompare,
  sha256Hash,
} from "./crypto";

describe("crypto", () => {
  describe("base64url encoding/decoding", () => {
    it("should round-trip encode/decode", () => {
      const original = new Uint8Array([0, 127, 255, 1, 128, 64]);
      const encoded = base64urlEncode(original);
      const decoded = base64urlDecode(encoded);

      expect(decoded).toEqual(original);
    });

    it("should produce URL-safe characters only", () => {
      // Test with bytes that would produce +, /, = in standard base64
      const data = new Uint8Array([251, 255, 254, 253, 252]);
      const encoded = base64urlEncode(data);

      expect(encoded).not.toContain("+");
      expect(encoded).not.toContain("/");
      expect(encoded).not.toContain("=");
    });

    it("should handle empty array", () => {
      const empty = new Uint8Array(0);
      const encoded = base64urlEncode(empty);
      const decoded = base64urlDecode(encoded);

      expect(encoded).toBe("");
      expect(decoded).toEqual(empty);
    });

    it("should handle single byte", () => {
      const single = new Uint8Array([42]);
      const encoded = base64urlEncode(single);
      const decoded = base64urlDecode(encoded);

      expect(decoded).toEqual(single);
    });
  });

  describe("generateRandomBytes", () => {
    it("should generate bytes of correct length", () => {
      const bytes16 = generateRandomBytes(16);
      const bytes32 = generateRandomBytes(32);
      const bytes64 = generateRandomBytes(64);

      expect(bytes16.length).toBe(16);
      expect(bytes32.length).toBe(32);
      expect(bytes64.length).toBe(64);
    });

    it("should generate different values each time", () => {
      const bytes1 = generateRandomBytes(32);
      const bytes2 = generateRandomBytes(32);

      expect(base64urlEncode(bytes1)).not.toBe(base64urlEncode(bytes2));
    });
  });

  describe("generateState", () => {
    it("should generate 43-character base64url string", () => {
      // 32 bytes = 256 bits -> base64url = ceil(256/6) = 43 characters
      const state = generateState();

      expect(state.length).toBe(43);
      expect(state).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("should generate unique values", () => {
      const states = new Set<string>();
      for (let i = 0; i < 100; i++) {
        states.add(generateState());
      }

      expect(states.size).toBe(100);
    });
  });

  describe("generateCodeVerifier", () => {
    it("should generate 43-character base64url string", () => {
      const verifier = generateCodeVerifier();

      expect(verifier.length).toBe(43);
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe("generateNonce", () => {
    it("should generate 22-character base64url string", () => {
      // 16 bytes = 128 bits -> base64url = ceil(128/6) = 22 characters
      const nonce = generateNonce();

      expect(nonce.length).toBe(22);
      expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe("generateCodeChallenge", () => {
    it("should produce deterministic output for same input", async () => {
      const verifier = "test-code-verifier-12345";
      const challenge1 = await generateCodeChallenge(verifier);
      const challenge2 = await generateCodeChallenge(verifier);

      expect(challenge1).toBe(challenge2);
    });

    it("should produce different output for different input", async () => {
      const challenge1 = await generateCodeChallenge("verifier1");
      const challenge2 = await generateCodeChallenge("verifier2");

      expect(challenge1).not.toBe(challenge2);
    });

    it("should produce base64url encoded SHA-256 hash", async () => {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);

      // SHA-256 = 32 bytes = 256 bits -> base64url = 43 characters
      expect(challenge.length).toBe(43);
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe("sha256Hash", () => {
    it("should produce deterministic output", async () => {
      const input = "test-input";
      const hash1 = await sha256Hash(input);
      const hash2 = await sha256Hash(input);

      expect(hash1).toBe(hash2);
    });

    it("should produce 43-character base64url string", async () => {
      const hash = await sha256Hash("any-input");

      expect(hash.length).toBe(43);
      expect(hash).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("should produce different hashes for different inputs", async () => {
      const hash1 = await sha256Hash("input1");
      const hash2 = await sha256Hash("input2");

      expect(hash1).not.toBe(hash2);
    });

    it("should handle empty string", async () => {
      const hash = await sha256Hash("");

      expect(hash.length).toBe(43);
    });

    it("should handle Unicode characters", async () => {
      const hashJp = await sha256Hash("こんにちは世界");
      const hashEmoji = await sha256Hash("Hello 🌍");

      expect(hashJp.length).toBe(43);
      expect(hashEmoji.length).toBe(43);
      // Different inputs should produce different hashes
      expect(hashJp).not.toBe(hashEmoji);
    });
  });

  describe("encrypt/decrypt", () => {
    const testSecret = "test-secret-key-12345";

    it("should successfully decrypt encrypted data", async () => {
      const plaintext = "Hello, World!";
      const encrypted = await encrypt(plaintext, testSecret);
      const decrypted = await decrypt(encrypted, testSecret);

      expect(decrypted).toBe(plaintext);
    });

    it("should produce different ciphertext for same plaintext (random IV)", async () => {
      const plaintext = "Same message";
      const encrypted1 = await encrypt(plaintext, testSecret);
      const encrypted2 = await encrypt(plaintext, testSecret);

      expect(encrypted1).not.toBe(encrypted2);

      // Both should still decrypt correctly
      expect(await decrypt(encrypted1, testSecret)).toBe(plaintext);
      expect(await decrypt(encrypted2, testSecret)).toBe(plaintext);
    });

    it("should fail decryption with wrong secret", async () => {
      const plaintext = "Secret message";
      const encrypted = await encrypt(plaintext, testSecret);

      await expect(decrypt(encrypted, "wrong-secret")).rejects.toThrow();
    });

    it("should handle empty string", async () => {
      const encrypted = await encrypt("", testSecret);
      const decrypted = await decrypt(encrypted, testSecret);

      expect(decrypted).toBe("");
    });

    it("should handle Unicode characters", async () => {
      const plaintext = "Hello World";
      const encrypted = await encrypt(plaintext, testSecret);
      const decrypted = await decrypt(encrypted, testSecret);

      expect(decrypted).toBe(plaintext);
    });

    it("should throw on truncated ciphertext", async () => {
      // Ciphertext needs at least salt(16) + iv(12) = 28 bytes
      const truncated = base64urlEncode(new Uint8Array(10));

      await expect(decrypt(truncated, testSecret)).rejects.toThrow();
    });

    it("should throw on tampered ciphertext", async () => {
      const encrypted = await encrypt("test", testSecret);
      // Tamper with the ciphertext by modifying some characters
      const tampered = `${encrypted.slice(0, -5)}XXXXX`;

      await expect(decrypt(tampered, testSecret)).rejects.toThrow();
    });
  });

  describe("generateSessionId", () => {
    it("should generate 43-character base64url string", () => {
      const sessionId = generateSessionId();

      expect(sessionId.length).toBe(43);
      expect(sessionId).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("should generate unique values", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateSessionId());
      }

      expect(ids.size).toBe(100);
    });
  });

  describe("generateId", () => {
    it("should generate 22-character base64url string", () => {
      const id = generateId();

      expect(id.length).toBe(22);
      expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    });

    it("should generate unique values", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }

      expect(ids.size).toBe(100);
    });
  });

  describe("secureCompare", () => {
    it("should return true for identical strings", () => {
      const str = "test-string-12345";

      expect(secureCompare(str, str)).toBe(true);
    });

    it("should return true for equal but different string instances", () => {
      const str1 = "test-string";
      const str2 = "test-" + "string";

      expect(secureCompare(str1, str2)).toBe(true);
    });

    it("should return false for different strings", () => {
      expect(secureCompare("string1", "string2")).toBe(false);
    });

    it("should return false for different lengths", () => {
      expect(secureCompare("short", "longer-string")).toBe(false);
      expect(secureCompare("longer-string", "short")).toBe(false);
    });

    it("should return true for empty strings", () => {
      expect(secureCompare("", "")).toBe(true);
    });

    it("should return false for similar but different tokens", () => {
      // Only the last character differs - important for timing attack resistance
      const token1 = "abcdefghij1234567890";
      const token2 = "abcdefghij1234567891";

      expect(secureCompare(token1, token2)).toBe(false);
    });
  });
});
