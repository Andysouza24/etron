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

    // Remove thousand separators globally
    const escaped = fmt.thousandSep.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    s = s.replace(new RegExp(escaped, 'g'), '');

    // Normalise decimal separator to '.'
    if (fmt.decimalSep !== '.') {
        s = s.replace(fmt.decimalSep, '.');
    }

    return s;
}


// Check whether a raw value looks numeric after sanitisation.
function isNumericString(value, numberFormat = DEFAULT_NUMBER_FORMAT) {
    if (value == null) return false;
    const sanitised = sanitiseNumberString(value, numberFormat);
    return /^-?\d+(\.\d+)?$/.test(sanitised);
}

module.exports = {
    sanitiseNumberString,
    isNumericString,
    NUMBER_FORMATS,
    DEFAULT_NUMBER_FORMAT,
};
