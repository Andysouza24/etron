// Author(s): Rhys Cleary

// validate the format of the data fetched
function validateFormat(data) {
    if (!Array.isArray(data) || data.length === 0) {
        return { valid: false, error: "Data must be a non-empty array of objects" };
    }

    // get the keys of the first row of objects
    const keys = Object.keys(data[0]);

    for (let i = 0; i < data.length; i++) {
        const row = data[i];

        if (typeof row !== "object" || row === null) {
            return { valid: false, error: `Row ${i} is not an object` };
        }

        const rowKeys = Object.keys(row);
        // validate the keys (headings) in each row
        if (rowKeys.length !== keys.length || !rowKeys.every((key) => keys.includes(key))) {
            return { valid: false, error: `Row ${i} has inconsistent headers` };
        }

        
        // Use this to reject empty fields when implementing toggle accept/reject empty fields in the UI
        /*
        // check for empty fields
        for (const [key, value] of Object.entries(row)) {
            if (value === null || value === undefined || value === "") {
                return { valid: false, error: `Empty field for ${key} in row ${i}` };
            }
        }
        */
    }

    return { valid: true };

}

module.exports = {
    validateFormat
};