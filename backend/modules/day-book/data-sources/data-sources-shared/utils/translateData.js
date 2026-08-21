const { parse } = require("csv-parse/sync");
const { v4: uuidv4 } = require('uuid');

function sanitiseKey(name) {
    return name.replace(/[^A-Za-z0-9_]/g, "_");
}

// normalize data into an array of objects
function translateData(rawData) {
    let rows = [];

    try {
        if (typeof rawData === "string") {
            const trimmed = rawData.trim();

            // check if JSON
            if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
                const parsed = JSON.parse(trimmed);
                rows = Array.isArray(parsed) ? parsed : [parsed];
            } else {
                // assume it's a csv
                rows = parse(trimmed, { columns: true, skip_empty_lines: true, cast: false });
            }

        } else if (Array.isArray(rawData)) {
            if (rawData.length === 0) return [];
            if (Array.isArray(rawData[0])) {
                // 2d array; spreadsheets
                const headers = rawData[0];
                rows = rawData.slice(1).map((row) => {
                    if (row.length !== headers.length) {
                        throw new Error("The row length is different to the header length");
                    }
                    return headers.reduce((acc, key, index) => {
                        acc[key] = row[index];
                        return acc;
                    }, {});
                });
            } else {
                // an array of objects
                rows = rawData;
            }
        } else if (typeof rawData === "object" && rawData !== null) {
            rows = [rawData];
        } else {
            throw new Error("Unsupported data type received");
        }

        // add a timestamp and id to each row
        const timestamp = new Date().toISOString();
        rows = rows.map((row) => {
            const normalizedRow = {};
            // Sanitise keys and convert NaN values to null to prevent schema inference issues
            for (const [key, value] of Object.entries(row)) {
                const sanitisedKey = sanitiseKey(key);
                if (typeof value === 'number' && Number.isNaN(value)) {
                    normalizedRow[sanitisedKey] = null;
                } else {
                    normalizedRow[sanitisedKey] = value;
                }
            }
            return {
                ...normalizedRow,
                timestamp,
                rowId: uuidv4(),
            };
        });

        return rows;
    } catch (error) {
        throw new Error(`Failed to translate the data: ${error.message}`);
    }
}

module.exports = {
    translateData
};