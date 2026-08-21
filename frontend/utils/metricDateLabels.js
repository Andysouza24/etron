// Human-readable label builders for the metric chart's date controls.
// The chart itself only consumes strings, so all calendar logic lives
// here.

// "DD/MM - DD/MM" range label shown next to the chevrons.
export function formatDateRangeLabel(start, end) {
    if (!start || !end) return "";
    const fmt = (d) => {
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        return `${day}/${month}`;
    };
    return `${fmt(start)} - ${fmt(end)}`;
}

// Header shown above the date range:
//   same month + year         => "MMMM"                 (e.g. "May")
//   two months, same year     => "MMMM – MMMM"          (e.g. "April – May")
//   two months, different yrs => "MMM YYYY – MMM YYYY"  (e.g. "Dec 2025 – Jan 2026")
export function buildMonthHeaderLabel(start, end) {
    if (!start || !end) return "";
    const sameYear = start.getFullYear() === end.getFullYear();
    const sameMonth = sameYear && start.getMonth() === end.getMonth();
    if (sameMonth) {
        return start.toLocaleDateString(undefined, { month: "long" });
    }
    if (sameYear) {
        const a = start.toLocaleDateString(undefined, { month: "long" });
        const b = end.toLocaleDateString(undefined, { month: "long" });
        return `${a} \u2013 ${b}`;
    }
    const a = start.toLocaleDateString(undefined, { month: "short", year: "numeric" });
    const b = end.toLocaleDateString(undefined, { month: "short", year: "numeric" });
    return `${a} \u2013 ${b}`;
}

// Unique month indices (0–11) present anywhere between `min` and `max`,
// in calendar order. Year-agnostic so the same month never appears twice.
export function buildMonthList(min, max) {
    if (!min || !max) return [];
    const present = new Set();
    const cursor = new Date(min.getFullYear(), min.getMonth(), 1);
    const endStop = new Date(max.getFullYear(), max.getMonth(), 1);
    while (cursor.getTime() <= endStop.getTime()) {
        present.add(cursor.getMonth());
        cursor.setMonth(cursor.getMonth() + 1);
    }
    return Array.from(present)
        .sort((a, b) => a - b)
        .map((monthIndex) => ({
            key: String(monthIndex),
            label: new Date(2000, monthIndex, 1).toLocaleDateString(undefined, {
                month: "long",
            }),
        }));
}
