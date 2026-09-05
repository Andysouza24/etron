// Shared helpers for coercing raw cell values into numbers.
// Kept in sync with the backend currency-stripping rules in
// backend/modules/day-book/data-sources/data-sources-shared/utils/numberSanitiser.js.

// Symbols that wrap a numeric value but must be stripped before parsing.
// Covers currency symbols, thousand-separator commas, and whitespace.
const NON_NUMERIC_CHARS = /[$€£¥₹₩₽¢₺₪฿₫₦₱₲₴₵₸₡₭,\s]/g;

function stripNonNumeric(value) {
    return String(value).replace(NON_NUMERIC_CHARS, "");
}

// Parse a value to a finite number, or return null on failure.
// Use for calculations, chart scales, aggregation, and formatting.
export function parseNumericOrNull(value) {
    if (value == null || value === "") return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const cleaned = stripNonNumeric(value);
    if (cleaned === "") return null;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
}

// Parse a value to a number, or return the original value on failure.
// Use when building rows that must keep non-numeric strings untouched,
// such as date columns and dimension labels.
export function parseNumericOrOriginal(value) {
    if (value == null || value === "") return value;
    if (typeof value === "number") return value;
    const cleaned = stripNonNumeric(value);
    if (cleaned === "") return value;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : value;
}

// Format a raw cell value for display in a data-preview table.
// Prefixes the currency symbol when the column is a value column with a
// detected currencySymbol and displayCurrencySymbol is not false.
// Non-value or non-numeric cells are returned as plain strings.
export function formatCellValue(value, column) {
    if (value == null || value === "") return "";
    if (!column) return String(value);

    const wantsCurrency =
        column.category === "value" &&
        column.currencySymbol &&
        column.displayCurrencySymbol !== false &&
        (column.type === "decimal(18,2)" || column.type === "double" || column.type === "bigint");

    if (!wantsCurrency) return String(value);

    const num = parseNumericOrNull(value);
    if (num == null) return String(value);
    const sign = num < 0 ? "-" : "";
    return `${sign}${column.currencySymbol}${Math.abs(num)}`;
}
