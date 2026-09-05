/**
Number string sanitisation utility.
Handles thousand separators and decimal separator normalisation.
numberFormat options:
  "dot_decimal"   — 1,234.56  (English/US — default)
  "comma_decimal" — 1.234,56  (European)
For now the default "dot_decimal" is used everywhere. In the future,
a per-column or per-workspace numberFormat can be stored and passed through.
 */

const NUMBER_FORMATS = {
    dot_decimal:   { decimalSep: '.', thousandSep: ',' },
    comma_decimal: { decimalSep: ',', thousandSep: '.' },
};

const DEFAULT_NUMBER_FORMAT = 'dot_decimal';


// Remove thousand separators and normalise the decimal separator to '.'.
// Returns a plain numeric string suitable for parseFloat / parseInt.
function sanitiseNumberString(value, numberFormat = DEFAULT_NUMBER_FORMAT) {
    const fmt = NUMBER_FORMATS[numberFormat] || NUMBER_FORMATS[DEFAULT_NUMBER_FORMAT];
    let s = String(value).trim();

    // Strip currency symbols, whitespace, and any other non-numeric characters.
    // Keep digits, sign, decimal/thousand separators, and scientific-notation markers.
    const keepChars = new Set(['-', '+', 'e', 'E', fmt.decimalSep, fmt.thousandSep]);
    s = Array.from(s).filter(ch => /\d/.test(ch) || keepChars.has(ch)).join('');

    // Remove thousand separators globally
    const escaped = fmt.thousandSep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    s = s.replace(new RegExp(escaped, 'g'), '');

    // Normalise decimal separator to '.'
    if (fmt.decimalSep !== '.') {
        s = s.replace(fmt.decimalSep, '.');
    }

    return s;
}


// Unicode currency symbols plus common ASCII ones used as prefixes/suffixes, excludes bare letters
const CURRENCY_SYMBOL_REGEX = /([$€£¥₹₩₽¢₺₪฿₫₦₱₲₴₵₸₡₭])/;


// Check whether a raw value looks numeric after sanitisation.
function isNumericString(value, numberFormat = DEFAULT_NUMBER_FORMAT) {
    if (value == null) return false;
    const fmt = NUMBER_FORMATS[numberFormat] || NUMBER_FORMATS[DEFAULT_NUMBER_FORMAT];
    let raw = String(value).trim();
    if (raw === '') return false;
    raw = raw.replace(new RegExp(CURRENCY_SYMBOL_REGEX.source, 'g'), '').replace(/\s+/g, ''); // strip currency symbols and internal whitespace before validating chars
    if (raw === '') return false;
    const allowed = new Set(['-', '+', 'e', 'E', fmt.decimalSep, fmt.thousandSep]);
    for (const ch of raw) {
        if (!/\d/.test(ch) && !allowed.has(ch)) return false;
    }
    const sanitised = sanitiseNumberString(value, numberFormat);
    return /^-?\d+(\.\d+)?$/.test(sanitised);
}


// Inspect a single raw value and return the first currency symbol found, or null
function extractCurrencySymbol(value) {
    if (value == null) return null;
    const s = String(value);
    const match = s.match(CURRENCY_SYMBOL_REGEX);
    return match ? match[1] : null;
}

// TODO: see if have multiple currency symbols in database - reasonable?
// Scan a list of sample values and return the most common currency symbol, provided it appears on at least half of the non-empty numeric-looking values
// Returns null if no dominant symbol is detected
function detectCurrencySymbol(values, numberFormat = DEFAULT_NUMBER_FORMAT) {
    const counts = {};
    let considered = 0;
    for (const v of values) {
        if (v == null || String(v).trim() === "") continue;
        if (!isNumericString(v, numberFormat)) continue;
        considered++;
        const sym = extractCurrencySymbol(v);
        if (sym) counts[sym] = (counts[sym] || 0) + 1;
    }
    if (considered === 0) return null;

    let best = null;
    let bestCount = 0;
    for (const [sym, count] of Object.entries(counts)) {
        if (count > bestCount) {
            best = sym;
            bestCount = count;
        }
    }
    return bestCount / considered >= 0.5 ? best : null;
}

module.exports = {
    sanitiseNumberString,
    isNumericString,
    extractCurrencySymbol,
    detectCurrencySymbol,
    NUMBER_FORMATS,
    DEFAULT_NUMBER_FORMAT,
};
