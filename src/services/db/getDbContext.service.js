const fs = require("fs");
const path = require("path");

// Caching for the schema summary to avoid reading the file repeatedly.
let cachedSchemaSummary = null;

/**
 * Reads the database schema summary (or model summary) from the file `dbSchemaSummary.md`
 * located in the `src/config/dbContext` folder.
 *
 * @returns {Promise<string>} The content of the schema summary.
 */
async function getDatabaseContext() {
  console.log("Entering getDatabaseSchemaSummary...");
  if (cachedSchemaSummary) {
    console.log("Returning cached schema summary.");
    return cachedSchemaSummary;
  }
  const filePath = path.join(__dirname, "../../config/db/dbSchemaSummary.md");
  try {
    console.log(`Reading schema summary from file: ${filePath}`);
    const schema = await fs.promises.readFile(filePath, "utf8");
    cachedSchemaSummary = schema;
    console.log("Schema summary loaded and cached.");
    return schema;
  } catch (error) {
    console.error("Error reading database schema summary:", error);
    throw error;
  }
}

module.exports = { getDatabaseContext };
