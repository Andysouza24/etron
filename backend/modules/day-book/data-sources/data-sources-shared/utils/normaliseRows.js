// normalises an array of objects to have the same keys (the union of all keys present) with `null` values for missing keys
// used for normalising rows from sources like MongoDB exports where different records may have different optional fields, which would otherwise cause "inconsistent headers" validation errors and schema inference issues
function normaliseHeterogeneousRows(rows) {
    if (!Array.isArray(rows) || rows.length === 0) return rows;

    const keySet = new Set();
    for (const row of rows) {
        if (row && typeof row === 'object') {
            for (const k of Object.keys(row)) keySet.add(k);
        }
    }
    const allKeys = Array.from(keySet);

    return rows.map((row) => {
        if (!row || typeof row !== 'object') return row;
        const out = {};
        for (const k of allKeys) {
            out[k] = Object.prototype.hasOwnProperty.call(row, k) ? row[k] : null;
        }
        return out;
    });
}

module.exports = {
    normaliseHeterogeneousRows,
};
