const fs = require("fs");
const path = require("path");
// Import of the models defined in src/models/index.js
const models = require("../../models/database");
// Caching for the schema summary to avoid reading the file repeatedly.
let cachedSchemaSummary = null;

/**
 * Reads the database schema summary (or model summary) from the file `dbSchemaSummary.md`
 * located in the `src/config/dbContext` folder.
 *
 * @returns {Promise<string>} The content of the schema summary.
 */
async function getDatabaseSchemaSummary() {
  console.log("Entering getDatabaseSchemaSummary...");
  if (cachedSchemaSummary) {
    console.log("Returning cached schema summary.");
    return cachedSchemaSummary;
  }
  const filePath = path.join(
    __dirname,
    "../../config/dbContext/dbSchemaSummary.md"
  );
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

/**
 * Executes a query using the specified Sequelize model.
 *
 * @param {object} queryObject - An object containing:
 *    - model: string, the model name (e.g., "User", "Organization")
 *    - method: string, the Sequelize method to execute (e.g., "findAll")
 *    - options: object, the query options to pass to the method
 * @returns {Promise<any>} The result of the query.
 */
async function executeSequelizeQuery(queryObject) {
  console.log("Executing Sequelize query with object:", queryObject);
  try {
    const { model, method, options } = queryObject;
    if (!models[model]) {
      throw new Error(`Model "${model}" not found.`);
    }
    if (typeof models[model][method] !== "function") {
      throw new Error(`Method "${method}" is not valid for model "${model}".`);
    }
    console.log(`Calling ${model}.${method} with options:`, options);
    const result = await models[model][method](options);
    console.log("Query executed successfully. Result:", result);
    return result;
  } catch (error) {
    console.error("Error executing Sequelize query:", error);
    throw error;
  }
}

module.exports = {
  getDatabaseSchemaSummary,
  executeSequelizeQuery,
};
