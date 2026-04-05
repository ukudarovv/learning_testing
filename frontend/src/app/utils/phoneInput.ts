/**
 * RU/KZ mobile: +7 и 10 цифр номера подряд, без пробелов (+77751234567).
 * Leading 8 is treated as +7 (local zero-eight format).
 */

export function normalizeRuKzPhoneDigits(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits[0] === '8') digits = '7' + digits.slice(1);
  if (digits[0] !== '7') digits = '7' + digits;
  return digits.slice(0, 11);
}

export function formatRuKzPhoneInput(raw: string): string {
  const digits = normalizeRuKzPhoneDigits(raw);
  if (digits.length === 0) return '';
  return `+${digits}`;
}
