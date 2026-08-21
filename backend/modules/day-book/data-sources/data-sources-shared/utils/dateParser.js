/*
Date format detection and parsing utility.
Detects common date formats from sample column values and converts them to ISO 8601 for consistent storage in Parquet/Athena.
Supported formats:
    YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD, YYYYMMDD
    DD/MM/YYYY, MM/DD/YYYY  (disambiguated via value analysis)
    DD-MM-YYYY, MM-DD-YYYY
    DD.MM.YYYY, MM.DD.YYYY
    D MMM YYYY, DD MMM YYYY  (e.g. "5 Jan 2024")
    MMM D, YYYY, MMM DD, YYYY (e.g. "Jan 5, 2024")
All of the above with optional time suffixes (HH:mm, HH:mm:ss, etc.)
*/

const MONTHS_SHORT = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

// Matches an optional time portion at the end of a date string
const TIME_SUFFIX_REGEX = /[\sT](\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)$/;

// Strips and returns the time portion from a date-time string.
function extractTimePart(value) {
    const match = value.match(TIME_SUFFIX_REGEX);
    if (match) {
        return {
            datePart: value.slice(0, match.index).trim(),
            timePart: match[1]
        };
    }
    return { datePart: value.trim(), timePart: null };
}

function monthToNum(name) {
    return MONTHS_SHORT[name.slice(0, 3).toLowerCase()] || 0;
}

// ---------- Format definitions ----------

const FORMAT_DEFS = {
    // Year-first (unambiguous)
    YMD_DASH: {
        regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
        extract: (m) => ({ year: +m[1], month: +m[2], day: +m[3] })
    },
    YMD_SLASH: {
        regex: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/,
        extract: (m) => ({ year: +m[1], month: +m[2], day: +m[3] })
    },
    YMD_DOT: {
        regex: /^(\d{4})\.(\d{1,2})\.(\d{1,2})$/,
        extract: (m) => ({ year: +m[1], month: +m[2], day: +m[3] })
    },
    COMPACT: {
        regex: /^(\d{4})(\d{2})(\d{2})$/,
        extract: (m) => ({ year: +m[1], month: +m[2], day: +m[3] })
    },

    // Day-month-year (slash / dash / dot) — one side of ambiguous pair
    DMY_SLASH: {
        regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
        extract: (m) => ({ day: +m[1], month: +m[2], year: +m[3] })
    },
    MDY_SLASH: {
        regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
        extract: (m) => ({ month: +m[1], day: +m[2], year: +m[3] })
    },
    DMY_DASH: {
        regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
        extract: (m) => ({ day: +m[1], month: +m[2], year: +m[3] })
    },
    MDY_DASH: {
        regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
        extract: (m) => ({ month: +m[1], day: +m[2], year: +m[3] })
    },
    DMY_DOT: {
        regex: /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,
        extract: (m) => ({ day: +m[1], month: +m[2], year: +m[3] })
    },
    MDY_DOT: {
        regex: /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,
        extract: (m) => ({ month: +m[1], day: +m[2], year: +m[3] })
    },

    // Named month formats (unambiguous)
    D_MMM_Y: {
        regex: /^(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{4})$/i,
        extract: (m) => ({ day: +m[1], month: monthToNum(m[2]), year: +m[3] })
    },
    MMM_D_Y: {
        regex: /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/i,
        extract: (m) => ({ month: monthToNum(m[1]), day: +m[2], year: +m[3] })
    },
};

// Pairs that share the same regex but differ in day/month interpretation
const AMBIGUOUS_PAIRS = [
    { dmy: "DMY_SLASH", mdy: "MDY_SLASH" },
    { dmy: "DMY_DASH",  mdy: "MDY_DASH" },
    { dmy: "DMY_DOT",   mdy: "MDY_DOT" },
];

// ---------- Helpers ----------

function isValidDate(year, month, day) {
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;
    if (year < 1900 || year > 2100) return false;
    const daysInMonth = new Date(year, month, 0).getDate();
    return day <= daysInMonth;
}


//Check if a single value matches a given format and produces a valid date.
function matchesFormat(value, formatId) {
    const { datePart } = extractTimePart(String(value).trim());
    const def = FORMAT_DEFS[formatId];
    if (!def) return false;
    const m = datePart.match(def.regex);
    if (!m) return false;
    const { year, month, day } = def.extract(m);
    return isValidDate(year, month, day);
}

function pad(n, len = 2) {
    return String(n).padStart(len, "0");
}

// ---------- Public API ----------


//Detect the date format of a column from a sample of its values.
function detectDateFormat(values) {
    const candidates = values
        .map(v => (v == null ? "" : String(v).trim()))
        .filter(v => v !== "" && v.toLowerCase() !== "nan");

    if (candidates.length === 0) return null;

    // require a meaningful sample
    const minRequired = Math.min(3, candidates.length);

    // 1. Try unambiguous formats first
    const unambiguous = ["YMD_DASH", "YMD_SLASH", "YMD_DOT", "COMPACT", "D_MMM_Y", "MMM_D_Y"];
    for (const formatId of unambiguous) {
        const matchCount = candidates.filter(v => matchesFormat(v, formatId)).length;
        if (matchCount >= minRequired && matchCount / candidates.length >= 0.8) {
            return formatId;
        }
    }

    // 2. Try ambiguous pairs — disambiguate using value ranges
    for (const pair of AMBIGUOUS_PAIRS) {
        const def = FORMAT_DEFS[pair.dmy]; // both share the same regex
        const matches = candidates.filter(v => {
            const { datePart } = extractTimePart(v);
            return def.regex.test(datePart);
        });

        if (matches.length < minRequired || matches.length / candidates.length < 0.8) continue;

        let firstOver12 = false;
        let secondOver12 = false;

        for (const v of matches) {
            const { datePart } = extractTimePart(v);
            const m = datePart.match(def.regex);
            if (m) {
                if (+m[1] > 12) firstOver12 = true;
                if (+m[2] > 12) secondOver12 = true;
            }
        }

        if (firstOver12 && !secondOver12) {
            // first part > 12, so it must be day → DD/MM/YYYY
            const allValid = matches.every(v => matchesFormat(v, pair.dmy));
            if (allValid) return pair.dmy;
        } else if (secondOver12 && !firstOver12) {
            // second part > 12, so it must be day → MM/DD/YYYY
            const allValid = matches.every(v => matchesFormat(v, pair.mdy));
            if (allValid) return pair.mdy;
        } else {
            // both parts ≤ 12 — truly ambiguous. Default to DMY (international convention).
            const allValid = matches.every(v => matchesFormat(v, pair.dmy));
            if (allValid) return pair.dmy;
        }
    }

    return null;
}


// Parse a date string using a known format into an ISO 8601 string (UTC).
function parseDate(value, formatId) {
    if (value == null) return null;
    const str = String(value).trim();
    if (str === "") return null;

    const { datePart, timePart } = extractTimePart(str);
    const def = FORMAT_DEFS[formatId];
    if (!def) return null;

    const m = datePart.match(def.regex);
    if (!m) return null;

    const { year, month, day } = def.extract(m);
    if (!isValidDate(year, month, day)) return null;

    if (timePart) {
        // Normalise: if no timezone indicator, treat as UTC
        const hasTimezone = /Z|[+-]\d{2}/.test(timePart);
        const normalizedTime = hasTimezone ? timePart : timePart + "Z";
        const isoString = `${pad(year, 4)}-${pad(month)}-${pad(day)}T${normalizedTime}`;
        const date = new Date(isoString);
        return isNaN(date.getTime()) ? null : date.toISOString();
    }

    // Date only → midnight UTC
    const date = new Date(Date.UTC(year, month - 1, day));
    return isNaN(date.getTime()) ? null : date.toISOString();
}

// ---------- User-specified format string parsing ----------


// Common date format presets available to users.
const COMMON_DATE_FORMATS = [
    { label: "DD/MM/YYYY",              value: "DD/MM/YYYY" },
    { label: "MM/DD/YYYY",              value: "MM/DD/YYYY" },
    { label: "YYYY-MM-DD",              value: "YYYY-MM-DD" },
    { label: "YYYY/MM/DD",              value: "YYYY/MM/DD" },
    { label: "DD-MM-YYYY",              value: "DD-MM-YYYY" },
    { label: "MM-DD-YYYY",              value: "MM-DD-YYYY" },
    { label: "DD.MM.YYYY",              value: "DD.MM.YYYY" },
    { label: "YYYY",                    value: "YYYY" },
    { label: "MM/YYYY",                 value: "MM/YYYY" },
    { label: "YYYY-MM",                 value: "YYYY-MM" },
    { label: "DD MMM YYYY (e.g. 14 Aug 2023)", value: "DD MMM YYYY" },
    { label: "MMM DD, YYYY (e.g. Aug 14, 2023)", value: "MMM DD, YYYY" },
    { label: "DD/MM/YYYY HH:mm",        value: "DD/MM/YYYY HH:mm" },
    { label: "MM/DD/YYYY HH:mm",        value: "MM/DD/YYYY HH:mm" },
    { label: "YYYY-MM-DD HH:mm:ss",     value: "YYYY-MM-DD HH:mm:ss" },
    { label: "DD/MM/YYYY HH:mm:ss",     value: "DD/MM/YYYY HH:mm:ss" },
];

// Token definitions for user format strings — ordered longest-first to avoid partial matches
const FORMAT_TOKENS = [
    { token: "YYYY", regex: "(\\d{4})",         part: "year" },
    { token: "YY",   regex: "(\\d{2})",         part: "year", transform: v => (+v < 50 ? 2000 + +v : 1900 + +v) },
    { token: "MMM",  regex: "([A-Za-z]{3,})",   part: "monthName" },
    { token: "MM",   regex: "(\\d{1,2})",       part: "month" },
    { token: "M",    regex: "(\\d{1,2})",       part: "month" },
    { token: "DD",   regex: "(\\d{1,2})",       part: "day" },
    { token: "D",    regex: "(\\d{1,2})",       part: "day" },
    { token: "HH",   regex: "(\\d{1,2})",       part: "hour" },
    { token: "hh",   regex: "(\\d{1,2})",       part: "hour" },
    { token: "mm",   regex: "(\\d{1,2})",       part: "minute" },
    { token: "ss",   regex: "(\\d{1,2})",       part: "second" },
];

// Build a regex and group-order from a user format string like "DD/MM/YYYY HH:mm:ss".
// Returns { regex: RegExp, groups: Array<{ part, transform? }> }
function compileUserFormat(formatStr) {
    let pattern = "";
    const groups = [];
    let i = 0;

    while (i < formatStr.length) {
        let matched = false;
        // Try each token (longest first, already sorted)
        for (const tokenDef of FORMAT_TOKENS) {
            if (formatStr.substring(i, i + tokenDef.token.length) === tokenDef.token) {
                pattern += tokenDef.regex;
                groups.push({ part: tokenDef.part, transform: tokenDef.transform });
                i += tokenDef.token.length;
                matched = true;
                break;
            }
        }
        if (!matched) {
            // Escape this character as a literal separator
            pattern += formatStr[i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            i++;
        }
    }

    return { regex: new RegExp("^" + pattern + "$", "i"), groups };
}

// Parse a date value using a user-specified format string (e.g. "DD/MM/YYYY").
// Returns ISO 8601 string or null.
function parseWithUserFormat(value, formatStr) {
    if (value == null || !formatStr) return null;
    const str = String(value).trim();
    if (str === "") return null;

    try {
        const { regex, groups } = compileUserFormat(formatStr);

        // Try the full string first
        let m = str.match(regex);

        // If no match and format has no time tokens, try stripping the time portion.
        // This handles cases like value="14/08/2023 10:30" with format="DD/MM/YYYY".
        if (!m) {
            const hasTimeTokens = groups.some(g =>
                g.part === "hour" || g.part === "minute" || g.part === "second"
            );
            if (!hasTimeTokens) {
                const { datePart } = extractTimePart(str);
                if (datePart !== str) {
                    m = datePart.match(regex);
                }
            }
        }

        if (!m) return null;

        let year = null, month = 1, day = 1, hour = 0, minute = 0, second = 0;

        for (let i = 0; i < groups.length; i++) {
            const raw = m[i + 1];
            const { part, transform } = groups[i];

            switch (part) {
                case "year":
                    year = transform ? transform(raw) : +raw;
                    break;
                case "month":
                    month = +raw;
                    break;
                case "monthName":
                    month = monthToNum(raw);
                    if (month === 0) return null;
                    break;
                case "day":
                    day = +raw;
                    break;
                case "hour":
                    hour = +raw;
                    break;
                case "minute":
                    minute = +raw;
                    break;
                case "second":
                    second = +raw;
                    break;
            }
        }

        if (year === null) return null;
        if (year < 100 && !groups.find(g => g.part === "year" && g.transform)) {
            year = year < 50 ? 2000 + year : 1900 + year;
        }

        // Validate ranges
        if (month < 1 || month > 12) return null;
        if (day < 1 || day > 31) return null;
        if (hour < 0 || hour > 23) return null;
        if (minute < 0 || minute > 59) return null;
        if (second < 0 || second > 59) return null;
        if (year < 1900 || year > 2100) return null;

        const daysInMonth = new Date(year, month, 0).getDate();
        if (day > daysInMonth) return null;

        const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
        return isNaN(date.getTime()) ? null : date.toISOString();
    } catch (e) {
        // compileUserFormat or regex match failed — return null so callers fall back
        return null;
    }
}

module.exports = {
    detectDateFormat,
    parseDate,
    matchesFormat,
    parseWithUserFormat,
    COMMON_DATE_FORMATS,
};
