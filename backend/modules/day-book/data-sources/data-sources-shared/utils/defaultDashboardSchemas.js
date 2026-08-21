// default field schemas for Micromax Dashboard export files
// each schema lives in `../schemas/<fileName>` and is used to skip the per-file review during connection setup
// users can adjust the schema later

const fs = require("fs");
const path = require("path");

const SCHEMAS_DIR = path.join(__dirname, "..", "schemas");

// returns the default schema array for a given export file name, or null if no default exists
// an empty array is a valid schema and means the file is known to be empty and has no fields to review
function getDefaultDashboardSchema(fileName) {
    if (!fileName || typeof fileName !== "string") return null;
    const safeName = path.basename(fileName);
    if (safeName !== fileName) return null;
    const schemaPath = path.join(SCHEMAS_DIR, safeName);
    try {
        const raw = fs.readFileSync(schemaPath, "utf8");
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return null;
        return parsed;
    } catch (err) {
        if (err && err.code === "ENOENT") return null;
        console.error(`[defaultDashboardSchemas] Failed to load schema for ${fileName}:`, err);
        return null;
    }
}

module.exports = {
    getDefaultDashboardSchema,
};
