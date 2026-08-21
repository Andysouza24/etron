import { useEffect } from "react";

// Seeds numberFormat.currencySymbol from the selected value column's schema metadata
// Runs only when the user has not yet chosen a symbol
// for this metric — existing per-metric selections are never overwritten
export default function useCurrencySymbolSeed(valueFieldName, valueFields, setNumberFormat) {
    useEffect(() => {
        if (!valueFieldName) return;
        const field = valueFields?.find((f) => f.name === valueFieldName);
        const detected = field?.currencySymbol;
        if (!detected) return;
        setNumberFormat((prev) => {
            if (prev?.currencySymbol) return prev;
            return { ...prev, currencySymbol: detected };
        });
    }, [valueFieldName, valueFields, setNumberFormat]);
}
