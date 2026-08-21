// Aggregation view constants and helpers.
// Groups time series into fixed buckets (week/month/year) with human-friendly labels.
// Backend pre-aggregates via `aggregatePeriod`; this module formats labels
// and synthesises empty buckets and secondary-axis markers for gaps.

export const AGGREGATION_PERIODS = ["daily", "weekly", "monthly", "yearly"];

// Cycle order used by the AggregationToggleButton.
export const NEXT_AGGREGATION_PERIOD = {
    daily: "weekly",
    weekly: "monthly",
    monthly: "yearly",
    yearly: "daily",
};

export const AGGREGATION_PERIOD_LABELS = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    yearly: "Yearly",
};

// Sentinel marker that identifies synthetic axis-marker rows. The xKey
// of a marker row starts with this prefix so the primary axis can blank
// its label while the secondary axis renders the month / year text.
export const AXIS_MARKER_PREFIX = "\u200B__AXIS_MARKER__:";

// Maps a UI period to the value the backend's `aggregatePeriod` query
// param expects. `daily` returns null because it bypasses the backend
// aggregation path entirely.
export function toBackendAggregatePeriod(period) {
    switch (period) {
        case "weekly": return "week";
        case "monthly": return "month";
        case "yearly": return "year";
        default: return null;
    }
}

function pad2(n) {
    return String(n).padStart(2, "0");
}

function toDateOrNull(value) {
    if (value == null) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function shortMonth(date) {
    return date.toLocaleDateString(undefined, { month: "short" });
}

// Returns the inclusive end-of-bucket date for a bucket starting on
// `startDate` for the given period.
export function getBucketEnd(startDate, period) {
    const start = toDateOrNull(startDate);
    if (!start) return null;
    if (period === "weekly") {
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        return end;
    }
    if (period === "monthly") {
        return new Date(start.getFullYear(), start.getMonth() + 1, 0);
    }
    if (period === "yearly") {
        return new Date(start.getFullYear(), 11, 31);
    }
    return start;
}

// Advance a bucket start by one period (used to fill gaps).
function nextBucketStart(startDate, period) {
    const start = new Date(startDate);
    if (period === "weekly") {
        start.setDate(start.getDate() + 7);
    } else if (period === "monthly") {
        start.setMonth(start.getMonth() + 1);
    } else if (period === "yearly") {
        start.setFullYear(start.getFullYear() + 1);
    }
    start.setHours(0, 0, 0, 0);
    return start;
}

// Step a bucket start backwards by one period.
// Used to left-pad the visible page with empty buckets when data is sparse.
export function previousBucketStart(startDate, period) {
    const start = toDateOrNull(startDate);
    if (!start) return null;
    const out = new Date(start);
    if (period === "weekly") {
        out.setDate(out.getDate() - 7);
    } else if (period === "monthly") {
        out.setMonth(out.getMonth() - 1);
    } else if (period === "yearly") {
        out.setFullYear(out.getFullYear() - 1);
    }
    out.setHours(0, 0, 0, 0);
    return out;
}

// Build the primary tick label for a single bucket.
// Labels carry a zero-width ISO suffix so identically-named buckets
// (e.g. "Jan" across years) don't collide as categorical x values.
// `stripPreFormattedLabelDetail` trims the suffix at render time.
export function buildAggregationTickLabel({ startDate, period }) {
    const start = toDateOrNull(startDate);
    if (!start) return "";

    if (period === "yearly") return String(start.getFullYear());

    const iso = `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`;

    if (period === "monthly") return `${shortMonth(start)}\u200B${iso}`;

    if (period === "weekly") {
        const end = getBucketEnd(start, period);
        const sameMonth = end && start.getMonth() === end.getMonth();
        if (sameMonth) {
            return `${pad2(start.getDate())} - ${pad2(end.getDate())}\u200B${iso}`;
        }
        // Cross-month: keep the visible chars as just "DD  DD" so the
        // secondary axis can drop a longer "MMM" tick centred between
        // them.
        return `${pad2(start.getDate())}  ${pad2(end.getDate())}\u200B${iso}`;
    }

    return "";
}

// Strip the zero-width disambiguator suffix (and blank axis-marker
// values entirely) so the chart axis renders only the human-readable
// portion of pre-formatted labels. Used by the primary tickFormat.
export function stripPreFormattedLabelDetail(value) {
    if (typeof value !== "string") return value;
    const zwsp = value.indexOf("\u200B");
    return zwsp >= 0 ? value.slice(0, zwsp) : value;
}

// Build a continuous list of bucket starts from `firstStart` to
// `lastStart` (inclusive) by stepping one period at a time. Used to fill
// gaps so empty buckets render on the axis like daily empty days do.
function buildContinuousStarts(firstStart, lastStart, period) {
    const starts = [];
    if (!firstStart || !lastStart) return starts;
    let cursor = new Date(firstStart);
    cursor.setHours(0, 0, 0, 0);
    const end = new Date(lastStart);
    end.setHours(0, 0, 0, 0);
    let guard = 0;
    while (cursor.getTime() <= end.getTime() && guard < 5000) {
        starts.push(new Date(cursor));
        cursor = nextBucketStart(cursor, period);
        guard += 1;
    }
    return starts;
}

// Build the unique xKey value for an axis-marker row.
function buildMarkerXValue(boundaryDate, kind) {
    const iso = `${boundaryDate.getFullYear()}-${pad2(boundaryDate.getMonth() + 1)}-${pad2(boundaryDate.getDate())}`;
    return `${AXIS_MARKER_PREFIX}${kind}:${iso}`;
}

// Decorate pre-aggregated rows with empty gap-buckets and secondary-axis markers.
// Returns { rows, secondaryTicks } where rows are evenly spaced categorical
// buckets and secondaryTicks carry month/year labels for the secondary axis.
export function decorateAggregatedRows(rows, xKey, period) {
    if (!Array.isArray(rows) || rows.length === 0 || !xKey || period === "daily") {
        return { rows: Array.isArray(rows) ? rows : [], secondaryTicks: [] };
    }

    // Index incoming rows by their bucket-start time so we can interleave
    // them with the synthesised continuous timeline.
    const rowByTime = new Map();
    let firstStart = null;
    let lastStart = null;
    for (const row of rows) {
        const start = toDateOrNull(row?.[xKey]);
        if (!start) continue;
        start.setHours(0, 0, 0, 0);
        rowByTime.set(start.getTime(), row);
        if (!firstStart || start < firstStart) firstStart = start;
        if (!lastStart || start > lastStart) lastStart = start;
    }
    if (!firstStart) {
        return { rows, secondaryTicks: [] };
    }

    const starts = buildContinuousStarts(firstStart, lastStart, period);
    const months = new Set(starts.map((d) => `${d.getFullYear()}-${d.getMonth()}`));
    const years = new Set(starts.map((d) => d.getFullYear()));
    const multiMonth = period !== "yearly" && months.size > 1;
    const multiYear = period !== "yearly" && years.size > 1;

    const outRows = [];
    const secondaryTicks = [];
    let prevStart = null;

    for (const start of starts) {
        // Cross-month weekly buckets render the month name inline.
        const bucketEnd = period === "weekly" ? getBucketEnd(start, period) : null;
        const isCrossMonth = period === "weekly"
            && bucketEnd
            && start.getMonth() !== bucketEnd.getMonth();

        const label = buildAggregationTickLabel({ startDate: start, period });
        const existing = rowByTime.get(start.getTime());
        if (existing) {
            outRows.push({
                ...existing,
                [xKey]: label,
                __bucketStartIso: start.toISOString(),
                __bucketLabel: label,
            });
        } else {
            // Synthetic empty bucket so the axis shows the gap.
            outRows.push({
                [xKey]: label,
                __bucketStartIso: start.toISOString(),
                __bucketLabel: label,
                __interpolated: true,
            });
        }

        // Place secondary ticks on the first bucket of a new month/year.
        // Skip when a cross-month bucket already announced the boundary
        // inline, to avoid duplicate month labels on the axis.
        const prevBucketEnd = prevStart && period === "weekly"
            ? getBucketEnd(prevStart, period)
            : null;
        const prevWasCrossMonth = !!(prevBucketEnd
            && prevStart.getMonth() !== prevBucketEnd.getMonth());
        const prevCrossedIntoCurrentMonth = prevWasCrossMonth
            && prevBucketEnd.getMonth() === start.getMonth()
            && prevBucketEnd.getFullYear() === start.getFullYear();
        const prevCrossedIntoCurrentYear = prevWasCrossMonth
            && prevBucketEnd.getFullYear() === start.getFullYear();

        if (period !== "yearly") {
            const monthChanged = !prevStart
                || prevStart.getMonth() !== start.getMonth()
                || prevStart.getFullYear() !== start.getFullYear();
            const yearChanged = !prevStart
                || prevStart.getFullYear() !== start.getFullYear();

            const wantYearMarker = multiYear
                && yearChanged
                && !prevCrossedIntoCurrentYear;
            // Month markers only apply to weekly view; monthly already shows MMM.
            // Skip when a cross-month bucket already labeled this month inline.
            const wantMonthMarker = period === "weekly"
                && multiMonth
                && monthChanged
                && !isCrossMonth
                && !prevCrossedIntoCurrentMonth;

            if (wantYearMarker || wantMonthMarker) {
                const labelLines = [];
                if (wantMonthMarker) labelLines.push(shortMonth(start));
                if (wantYearMarker) labelLines.push(String(start.getFullYear()));
                secondaryTicks.push({ x: label, label: labelLines.join("\n") });
            }
        }

        // Cross-month weekly buckets get an inline boundary tick
        // labeling the new month entered during this bucket.
        if (isCrossMonth) {
            secondaryTicks.push({ x: label, label: shortMonth(bucketEnd) });
        }

        prevStart = start;
    }

    return { rows: outRows, secondaryTicks };
}

// Helper for primary-axis tickFormat callbacks. Returns true when the
// xKey value belongs to a synthetic axis-marker row whose label is
// rendered by the secondary axis instead.
export function isAxisMarkerXValue(value) {
    return typeof value === "string" && value.startsWith(AXIS_MARKER_PREFIX);
}
