// Import of the models defined in src/models/index.js
const models = require("../../models/db");

/**
 * Executes a query using the specified Sequelize model.
 *
 * @param {object} queryObject - An object containing:
 *    - model: string, the model name (e.g., "User", "Organization")
 *    - method: string, the Sequelize method to execute (e.g., "findAll")
 *    - options: object, the query options to pass to the method
 * @returns {Promise<any>} The result of the query.
 */
async function executeQuery(queryObject) {
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
  executeQuery,
};
