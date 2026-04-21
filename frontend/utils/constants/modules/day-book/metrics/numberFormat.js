// Default display format for metric numeric values
// Applied when a metric is first created; per-metric overrides live in the metric's stored config under `config.numberFormat`
export const DEFAULT_NUMBER_FORMAT = Object.freeze({
    currencySymbol: "",
    thousandsSeparator: ",",
    decimalSeparator: ".",
    decimalPlaces: null,
});
