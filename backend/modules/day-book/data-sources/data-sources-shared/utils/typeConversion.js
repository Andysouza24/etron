const parquet = require('parquetjs-lite');
const parquetTypes = require('parquetjs-lite/lib/types');
const { Writable } = require('stream');
const { parseDate, parseWithUserFormat } = require('./dateParser');
const { sanitiseNumberString } = require('./numberSanitiser');

// parquetjs-lite decodes timestamps as BigInt but its built-in Date conversion crashes on BigInt - patch it to coerce to Number first
(function patchParquetTimestampDecoding() {
    const logicalTypes = parquetTypes && parquetTypes.PARQUET_LOGICAL_TYPES;
    if (!logicalTypes) return;

    const toNumber = (value) => (typeof value === 'bigint' ? Number(value) : +value);

    if (logicalTypes.TIMESTAMP_MILLIS) {
        logicalTypes.TIMESTAMP_MILLIS.fromPrimitive = function (value) {
            return new Date(toNumber(value));
        };
    }
    if (logicalTypes.TIMESTAMP_MICROS) {
        logicalTypes.TIMESTAMP_MICROS.fromPrimitive = function (value) {
            const micros = typeof value === 'bigint' ? value : BigInt(value);
            return new Date(Number(micros / 1000n));
        };
    }
})();

// Parquet INT64 range: signed 64-bit. Writing a value outside this range throws ERR_OUT_OF_RANGE.
const INT64_MAX = 9223372036854775807n; // 2^63 - 1
const INT64_MIN = -9223372036854775808n; // -(2^63)

function fitsInInt64(intLikeString) {
    try {
        const big = BigInt(String(intLikeString).trim());
        return big >= INT64_MIN && big <= INT64_MAX;
    } catch {
        return false;
    }
}

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

    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
        const row = data[rowIndex];
        const castedRow = {};
        let currentColumn = null;
        try {
            for (const column of schema) {
                const name = column.name;
                const type = column.type;
                currentColumn = name;
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
                        } else if (bigintVal !== null && !fitsInInt64(sanitisedBI)) {
                            // Value exceeds INT64 range; cannot be encoded as parquet INT64.
                            // Null it out instead of crashing the entire batch.
                            console.warn(`Warning: value out of INT64 range in bigint column "${name}" (value: ${value}), converting to null`);
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
            currentColumn = null;
            await writer.appendRow(castedRow);
        } catch (originalError) {
            // Surface row (and column when known) context so callers can produce a user-friendly error message.
            const baseMessage = originalError && originalError.message ? originalError.message : String(originalError);
            const wrapped = new Error(baseMessage);
            wrapped.rowIndex = rowIndex;
            if (currentColumn) wrapped.columnName = currentColumn;
            wrapped.cause = originalError;
            throw wrapped;
        }
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