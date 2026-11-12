import { createHash, randomInt } from 'node:crypto';
import { z } from '@hono/zod-openapi';

/** No 0/O or 1/I, so codes can be read out loud or typed from a screenshot. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 12;

/** Removes dashes and spaces and upper-cases. "abcd-efgh jklm" -> "ABCDEFGHJKLM". */
export function normalizeAccessCode(code: string): string {
  return code.replace(/[\s-]/g, '').toUpperCase();
}

/** Formats a normalised code for display: ABCD-EFGH-JKLM. */
export function formatAccessCode(normalized: string): string {
  return normalized.match(/.{1,4}/g)?.join('-') ?? normalized;
}

/**
 * Generates a random code (12 characters from a 32 character alphabet,
 * about 60 bits of entropy).
 * @returns Code formatted as ABCD-EFGH-JKLM
 */
export function generateAccessCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return formatAccessCode(code);
}

/**
 * Hashes a code for storage and lookup. A plain SHA-256 is enough here: the
 * codes are random, high entropy, short lived and redemption is rate limited.
 */
export function hashAccessCode(code: string): string {
  return createHash('sha256').update(normalizeAccessCode(code)).digest('hex');
}

/** Last four characters, shown to admins to tell codes apart. */
export function accessCodeHint(code: string): string {
  return normalizeAccessCode(code).slice(-4);
}

export const AccessCodeInputSchema = z
  .string()
  .transform(normalizeAccessCode)
  .refine((code) => /^[A-Z0-9]{12}$/.test(code), {
    message: 'Access code must look like ABCD-EFGH-JKLM.',
  });
