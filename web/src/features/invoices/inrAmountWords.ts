/**
 * Indian English amount in words for invoices (rupees + paise).
 * Uses crore / lakh / thousand grouping.
 */

const BELOW_20 = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];

const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function twoDigits(n: number): string {
  if (n < 20) return BELOW_20[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return TENS[t] + (o ? ` ${BELOW_20[o]}` : '');
}

/** 1–999 → words; zero → '' */
function threeDigits(n: number): string {
  if (n === 0) return '';
  const h = Math.floor(n / 100);
  const rest = n % 100;
  let w = '';
  if (h) w += `${BELOW_20[h]} hundred`;
  if (rest) {
    if (w) w += ' ';
    w += twoDigits(rest);
  }
  return w;
}

function trimJoin(...parts: string[]): string {
  return parts
    .filter((p) => p.trim().length > 0)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function integerToIndianWords(n: number): string {
  if (n === 0) return '';
  if (n < 0) return trimJoin('negative', integerToIndianWords(-n));

  if (n >= 10000000) {
    const c = Math.floor(n / 10000000);
    const r = n % 10000000;
    return trimJoin(`${integerToIndianWords(c)} crore`, integerToIndianWords(r));
  }
  if (n >= 100000) {
    const l = Math.floor(n / 100000);
    const r = n % 100000;
    return trimJoin(`${threeDigits(l)} lakh`, integerToIndianWords(r));
  }
  if (n >= 1000) {
    const t = Math.floor(n / 1000);
    const r = n % 1000;
    return trimJoin(`${threeDigits(t)} thousand`, integerToIndianWords(r));
  }
  return threeDigits(n);
}

function capitalizeSentence(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** e.g. Rupees Twelve thousand four hundred fifty Only — includes paise when needed */
export function inrAmountToWords(amount: number): string {
  const totalPaise = Math.round(amount * 100);
  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;

  const rupeeWords = rupees === 0 ? 'zero' : integerToIndianWords(rupees);
  let out = `Rupees ${rupeeWords}`;
  if (paise > 0) {
    out += ` and ${integerToIndianWords(paise)} paise`;
  }
  return `${capitalizeSentence(out)} Only`;
}
