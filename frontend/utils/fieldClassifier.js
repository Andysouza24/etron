// Classifies data-source schema fields into date / dimension / value buckets.
// Drives which fields are offered as axes, groupings, and metric values.

const DATE_TYPES = ["timestamp", "date", "datetime", "time"];
const STRING_TYPES = ["string", "varchar", "char", "text"];

// Map a raw column type string to one of "date", "dimension", or "value".
export function classifyFieldType(type) {
    const t = (type ?? "").toLowerCase();
    if (DATE_TYPES.some((dt) => t.includes(dt))) return "date";
    if (STRING_TYPES.some((st) => t.includes(st))) return "dimension";
    return "value";
}

export function classifySchemaFields(schema) {
    const dateFields = [];
    const dimensionFields = [];
    const valueFields = [];

    if (!Array.isArray(schema)) return { dateFields, dimensionFields, valueFields };

    for (const field of schema) {
        // Prefer the backend's category and fall back to inferring from the type.
        const category = field.category || classifyFieldType(field.type);
        const classified = {
            name: field.name,
            type: field.type,
            category,
            currencySymbol: field.currencySymbol ?? null,
        };

        if (category === "date") dateFields.push(classified);
        else if (category === "dimension") dimensionFields.push(classified);
        else valueFields.push(classified);
    }

    return { dateFields, dimensionFields, valueFields };
}

export function toDropdownItems(fields) {
    return fields.map((f) => ({
        value: f.name,
        label: f.name,
    }));
}
