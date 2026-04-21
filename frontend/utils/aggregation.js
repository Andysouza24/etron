import { parseNumericOrNull } from "./numberParser";

export function aggregateData(data, dateKey, valueKeys, aggregationType) {
    const groups = new Map();
    for (const row of data) {
        const dateVal = row[dateKey];
        if (!groups.has(dateVal)) groups.set(dateVal, []);
        groups.get(dateVal).push(row);
    }

    return Array.from(groups, ([dateVal, rows]) => {
        const result = { [dateKey]: dateVal };
        for (const key of valueKeys) {
            const values = rows.map((r) => parseNumericOrNull(r[key])).filter((v) => v != null);
            switch (aggregationType) {
                case "sum":
                    result[key] = values.reduce((a, b) => a + b, 0);
                    break;
                case "avg":
                    result[key] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
                    break;
                case "min":
                    result[key] = Math.min(...values);
                    break;
                case "max":
                    result[key] = Math.max(...values);
                    break;
                case "count":
                    result[key] = values.length;
                    break;
            }
        }
        return result;
    });
}

export function hasDuplicateValues(data, key) {
    if (!key || !data.length) return false;
    const values = data.map((row) => row[key]);
    return new Set(values).size !== values.length;
}
