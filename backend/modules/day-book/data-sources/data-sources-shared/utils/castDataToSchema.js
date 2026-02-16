function castDataToSchema(data, schema) {
    return data.map(row => {
        const castedRow = {};

        for (const { name, type } of schema) {
            let value = row[name];

            if (value == null || value === "") {
                castedRow[name] = null;
                continue;
            }

            switch (type) {
                case "bigint":
                    const bigintVal = Number.isNaN(Number(value)) ? null : parseInt(value, 10);
                    castedRow[name] = (bigintVal !== null && Number.isNaN(bigintVal)) ? null : bigintVal;
                    break;
                case "double":
                case "decimal(18,2)":
                    const doubleVal = Number.isNaN(Number(value)) ? null : parseFloat(value);
                    castedRow[name] = (doubleVal !== null && Number.isNaN(doubleVal)) ? null : doubleVal;
                    break;
                case "boolean":
                    if (typeof value === "string") {
                        castedRow[name] = value.toLowerCase() === "true" || value === "1";
                    } else {
                        castedRow[name] = Boolean(value);
                    }
                    break;
                case "timestamp":
                    const date = new Date(value);
                    castedRow[name] = isNaN(date.getTime()) ? null : date.toISOString();
                    break;
                case "string":
                default:
                    castedRow[name] = String(value);
                    break;
            }        
        }

        return castedRow;
    });
}

module.exports = {
    castDataToSchema
};