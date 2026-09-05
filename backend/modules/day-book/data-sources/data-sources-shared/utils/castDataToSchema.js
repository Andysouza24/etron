const { parseDate, parseWithUserFormat } = require("./dateParser");
const { sanitiseNumberString } = require("./numberSanitiser");

function castDataToSchema(data, schema) {
    return data.map(row => {
        const castedRow = {};

        for (const { name, type, dateFormat, userDateFormat } of schema) {
            let value = row[name];

            if (value == null || value === "") {
                castedRow[name] = null;
                continue;
            }

            switch (type) {
                case "bigint":
                    const sanitisedBigint = sanitiseNumberString(String(value));
                    const bigintVal = Number.isNaN(Number(sanitisedBigint)) ? null : parseInt(sanitisedBigint, 10);
                    castedRow[name] = (bigintVal !== null && Number.isNaN(bigintVal)) ? null : bigintVal;
                    break;
                case "double":
                case "decimal(18,2)":
                    const sanitisedDouble = sanitiseNumberString(String(value));
                    const doubleVal = Number.isNaN(Number(sanitisedDouble)) ? null : parseFloat(sanitisedDouble);
                    castedRow[name] = (doubleVal !== null && Number.isNaN(doubleVal)) ? null : doubleVal;
                    break;
                case "boolean":
                    if (typeof value === "string") {
                        castedRow[name] = value.toLowerCase() === "true" || value === "1";
                    } else {
                        castedRow[name] = Boolean(value);
                    }
                    break;
                case "timestamp": {
                    // Sequential fallback: userDateFormat → dateFormat → native Date
                    let isoResult = null;

                    if (userDateFormat) {
                        isoResult = parseWithUserFormat(value, userDateFormat);
                    }

                    if (!isoResult && dateFormat) {
                        isoResult = parseDate(value, dateFormat);
                    }

                    if (!isoResult) {
                        const date = new Date(value);
                        isoResult = isNaN(date.getTime()) ? null : date.toISOString();
                    }

                    castedRow[name] = isoResult;
                    break;
                }
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