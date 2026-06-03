// Chart-type classification used by MetricGraph + MetricViewer to decide
// which surrounding controls (aggregation toggle, year filter, paged
// scroll) are meaningful for a given metric.

// Time-series chart types route through the date-aware view machinery
// (display view, aggregation view, paged scroll). Other chart types
// (pie, box, etc.) are rendered as-is.
export const TIME_SERIES_TYPES = new Set([
    "line",
    "bar",
    "area",
    "scatter",
    "histogram",
]);

// Chart types where interpolating across missing days produces a useful
// continuous line. Bars / scatters / histograms stay disconnected.
export const INTERPOLATABLE_CHART_TYPES = new Set(["line", "area"]);

export const isTimeSeriesChartType = (chartType) =>
    chartType != null && TIME_SERIES_TYPES.has(chartType);
