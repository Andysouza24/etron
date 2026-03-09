const DATE_TYPES = ["timestamp", "date", "datetime", "time"];
const STRING_TYPES = ["string", "varchar", "char", "text"];

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
        // Use pre-classified category from backend if available, otherwise infer from type
        const category = field.category || classifyFieldType(field.type);
        const classified = { name: field.name, type: field.type, category };

        if (category === "date") dateFields.push(classified);
        else if (category === "dimension") dimensionFields.push(classified);
        else valueFields.push(classified);
    }

    return { dateFields, dimensionFields, valueFields };
}

export function toDropdownItems(fields) {
    return fields.map((f) => ({
        value: f.name,
        label: `${f.name} (${f.category})`,
    }));
}
