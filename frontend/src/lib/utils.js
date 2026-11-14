import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

/**
 * Combines Tailwind classes cleanly with clsx and tailwind-merge
 * @param  {...any} inputs
 * @returns {string}
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a monetary amount into the Indian numbering format (e.g., ₹12,34,567.50)
 * WITHOUT using JavaScript floating point math on the string representation.
 * @param {string|number} value - The "X.XX" string or number from API
 * @param {boolean} [showSymbol=true] - Whether to prefix with ₹
 * @returns {string} Formatted Indian Rupee string
 */
export function formatINR(value, showSymbol = true) {
  if (value === undefined || value === null || value === '') {
    return showSymbol ? '₹0.00' : '0.00';
  }

  const str = String(value).trim();
  // Handle optional negative sign
  const isNegative = str.startsWith('-');
  const cleanStr = isNegative ? str.slice(1) : str;

  const parts = cleanStr.split('.');
  let integerPart = parts[0] || '0';
  // Strip leading zeroes except single '0'
  integerPart = integerPart.replace(/^0+(?=\d)/, '');
  if (!integerPart) integerPart = '0';

  let decimalPart = parts[1] || '00';
  if (decimalPart.length === 1) decimalPart += '0';
  else if (decimalPart.length > 2) decimalPart = decimalPart.slice(0, 2);

  // Indian format: last 3 digits, then groups of 2
  let lastThree = integerPart.slice(-3);
  const otherDigits = integerPart.slice(0, -3);

  let formattedInteger = lastThree;
  if (otherDigits !== '') {
    const formattedOther = otherDigits.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    formattedInteger = `${formattedOther},${lastThree}`;
  }

  const result = `${formattedInteger}.${decimalPart}`;
  if (isNegative) {
    return showSymbol ? `-₹${result}` : `-${result}`;
  }
  return showSymbol ? `₹${result}` : result;
}

const KOLKATA_TIMEZONE = 'Asia/Kolkata';

/**
 * Formats a Date or ISO string into Asia/Kolkata timezone
 * @param {Date|string|number} date
 * @param {string} [formatStr='dd MMM yyyy, hh:mm a']
 * @returns {string}
 */
export function formatKolkata(date, formatStr = 'dd MMM yyyy, hh:mm a') {
  if (!date) return '';
  try {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    const zoned = toZonedTime(d, KOLKATA_TIMEZONE);
    return format(zoned, formatStr);
  } catch {
    return '';
  }
}

/**
 * Formats date only (e.g. 15 Oct 2026)
 */
export function formatKolkataDate(date) {
  return formatKolkata(date, 'dd MMM yyyy');
}

/**
 * Formats time only (e.g. 10:30 AM)
 */
export function formatKolkataTime(date) {
  return formatKolkata(date, 'hh:mm a');
}

/**
 * Formats relative time (e.g. "5 minutes ago", "2 days ago")
 */
export function formatRelativeTime(date) {
  if (!date) return '';
  try {
    const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return '';
  }
}
