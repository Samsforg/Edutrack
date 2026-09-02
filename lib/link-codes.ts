import { createHash, randomBytes } from "node:crypto";

/**
 * Link codes: EDU-XXXX-XXXX using an unambiguous alphabet.
 * ONLY the salted SHA-256 hash of a code is ever persisted.
 */

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const LINK_CODE_REGEX = /^EDU-[A-Z1-9]{4}-[A-Z1-9]{4}$/;

const GROUP_LENGTH = 4;

function randomChars(n: number): string {
  // ALPHABET.length = 32 divides 256 evenly -> no modulo bias.
  const bytes = randomBytes(n);
  let out = "";
  for (let i = 0; i < n; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/** Generates a code of the form EDU-XXXX-XXXX. */
export function generateLinkCode(): string {
  return `EDU-${randomChars(GROUP_LENGTH)}-${randomChars(GROUP_LENGTH)}`;
}

/** Normalizes user input: trims and uppercases. */
export function normalizeLinkCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Validates the shape of a link code before any network call. */
export function isValidLinkCode(code: string): boolean {
  return LINK_CODE_REGEX.test(normalizeLinkCode(code));
}

/** 16 random bytes as hex — unique per generated code. */
export function generateCodeSalt(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Computes the storage hash: sha256(salt || normalizedCode).
 * Matches the SQL-side lookup in the RPCs (`digest(c.code_salt ||
 * upper(btrim(p_code)), 'sha256')`).
 */
export function hashLinkCode(code: string, salt: string): string {
  const normalized = normalizeLinkCode(code);
  return createHash("sha256")
    .update(`${salt}${normalized}`, "utf8")
    .digest("hex");
}