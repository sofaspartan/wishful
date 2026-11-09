import { randomInt } from 'node:crypto';
import { safeEqual, sha256 } from '../util';

/** No 0/O, 1/I/L so a handwritten code can't be misread. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const GROUPS = 5;
const GROUP_LENGTH = 4;

/** A 20-character code (~99 bits) shown to the user once, e.g. `K7QM-4HXP-9TWB-RC3N-E8YF`. */
export function newRecoveryCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g++) {
    let group = '';
    for (let i = 0; i < GROUP_LENGTH; i++) group += ALPHABET[randomInt(ALPHABET.length)];
    groups.push(group);
  }
  return groups.join('-');
}

/** Ignores case, spaces and dashes. */
export const normalizeRecoveryCode = (code: string) => code.toUpperCase().replace(/[^0-9A-Z]/g, '');

export const hashRecoveryCode = (code: string) => sha256(`recovery:${normalizeRecoveryCode(code)}`);

export function recoveryCodeMatches(code: string, hash: string | undefined): boolean {
  return Boolean(hash) && safeEqual(hashRecoveryCode(code), hash!);
}
