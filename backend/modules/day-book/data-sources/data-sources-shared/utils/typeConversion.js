const parquet = require('parquetjs-lite');
const { Writable } = require('stream');
const { parseDate, parseWithUserFormat } = require('./dateParser');
const { sanitiseNumberString } = require('./numberSanitiser');

async function toParquet(data, schema) {
    if (!Array.isArray(data) || data.length === 0) {
        throw new Error("The data must be a non-empty array");
    }

    const schemaDef = {};

    for (const column of schema) {
        switch (column.type) {
            case "bigint":
                schemaDef[column.name] = { type: 'INT64', optional: true };
                break;
            case "double":
            case "decimal(18,2)":
                schemaDef[column.name] = { type: 'DOUBLE', optional: true };
                break;
            case "boolean":
                schemaDef[column.name] = { type: 'BOOLEAN', optional: true };
                break;
            case "timestamp":
                schemaDef[column.name] = { type: 'TIMESTAMP_MILLIS', optional: true };
                break;
            case "string":
            default:
                schemaDef[column.name] = { type: 'UTF8', optional: true };
                break;

        }
    }

    const parquetSchema = new parquet.ParquetSchema(schemaDef);

    let chunks = [];
    const writable = new Writable({
        write(chunk, encoding, callback) {
            chunks.push(chunk);
            callback();
        }
    });

    const writer = await parquet.ParquetWriter.openStream(parquetSchema, writable);

    for (const row of data) {
        const castedRow = {};
        for (const column of schema) {
            const name = column.name;
            const type = column.type;
            let value = row[name];

            if (value == null) {
                castedRow[name] = null;
                continue;
            }

            switch (type) {
                case "bigint":
                    const sanitisedBI = sanitiseNumberString(String(value));
                    const bigintVal = Number.isNaN(Number(sanitisedBI)) ? null : Number(sanitisedBI);
                    if (bigintVal !== null && Number.isNaN(bigintVal)) {
                        console.warn(`Warning: NaN detected in bigint column "${name}" with value: ${value}, converting to null`);
                        castedRow[name] = null;
                    } else {
                        castedRow[name] = bigintVal;
                    }
                    break;
                case "double":
                case "decimal(18,2)":
                    const sanitisedDB = sanitiseNumberString(String(value));
                    const doubleVal = Number.isNaN(Number(sanitisedDB)) ? null : Number(sanitisedDB);
                    if (doubleVal !== null && Number.isNaN(doubleVal)) {
                        console.warn(`Warning: NaN detected in double column "${name}" with value: ${value}, converting to null`);
                        castedRow[name] = null;
                    } else {
                        castedRow[name] = doubleVal;
                    }
                    break;
                case "boolean":
                    castedRow[name] = Boolean(value);
                    break;
                case "timestamp":
                    // Data arriving here is typically already ISO strings from castDataToSchema.
                    // Try native Date first (handles ISO strings, epoch numbers, Date objects).
                    // Only fall back to format-specific parsers for raw data edge cases.
                    let dateObj;

                    if (value instanceof Date) {
                        dateObj = value;
                    } else if (typeof value === 'bigint') {
                        dateObj = new Date(Number(value));
                    } else if (typeof value === 'string' || typeof value === 'number') {
                        dateObj = new Date(value);
                    }

                    // If native parse failed and we have format hints, try them
                    if ((!dateObj || isNaN(dateObj.getTime())) && typeof value === 'string') {
                        dateObj = null;
                        if (column.userDateFormat) {
                            const parsed = parseWithUserFormat(value, column.userDateFormat);
                            if (parsed) dateObj = new Date(parsed);
                        }
                        if (!dateObj && column.dateFormat) {
                            const parsed = parseDate(value, column.dateFormat);
                            if (parsed) dateObj = new Date(parsed);
                        }
                    }

                    if (dateObj instanceof Date && !isNaN(dateObj.getTime())) {
                        castedRow[name] = dateObj;
                    } else {
                        castedRow[name] = null;
                    }
                    break;
                case "string":
                default:
                    castedRow[name] = String(value);
            }
        }
        await writer.appendRow(castedRow);
    }

    await writer.close();

    return Buffer.concat(chunks);
}

async function fromParquet(buffer, schema) {
    const reader = await parquet.ParquetReader.openBuffer(buffer);
    const cursor = reader.getCursor();
    const records = [];

    let record;
    while (record = await cursor.next()) {
        const casted = {};
        for (const column of schema) {
            let val = record[column.name];
            if (val == null) {
                casted[column.name] = null;
                continue;
            }
            switch (column.type) {
                case "bigint":
                    casted[column.name] = Number(val);
                    break;
                case "double":
                case "decimal(18,2)":
                    casted[column.name] = Number(val);
                    break;
                case "boolean":
                    casted[column.name] = Boolean(val);
                    break;
                case "timestamp":
                    if (typeof val === 'bigint') val = Number(val);
                    casted[column.name] = new Date(val);
                    break;
                case "string":
                default:
                    casted[column.name] = String(val);
            }
        }
        records.push(casted);
    }

    await reader.close();
    return records;
}

module.exports = { toParquet, fromParquet };