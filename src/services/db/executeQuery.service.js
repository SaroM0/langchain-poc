// Import the models defined in src/models/db/index.js
const models = require("../../models/db");

/**
 * Recursively resolves model references in the "include" options.
 * If an element with a "model" property defined as a string is found,
 * it is replaced with the actual model object from the models registry.
 *
 * @param {any} includeOption - The "include" option to resolve.
 * @returns {any} The "include" option with the resolved models.
 */
function resolveInclude(includeOption) {
  if (Array.isArray(includeOption)) {
    return includeOption.map((item) => resolveInclude(item));
  } else if (typeof includeOption === "object" && includeOption !== null) {
    if (includeOption.model && typeof includeOption.model === "string") {
      const resolvedModel = models[includeOption.model];
      if (!resolvedModel) {
        throw new Error(`Included model "${includeOption.model}" not found`);
      }
      includeOption = { ...includeOption, model: resolvedModel };
    }
    if (includeOption.include) {
      includeOption.include = resolveInclude(includeOption.include);
    }
    return includeOption;
  } else {
    return includeOption;
  }
}

/**
 * Executes a query using the specified Sequelize model.
 *
 * @param {object} queryObject - An object containing:
 *    - model: string, the name of the model (e.g., "User", "Organization")
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

    // Resolve model references in "include" if present in the options.
    let resolvedOptions = { ...options };
    if (resolvedOptions.include) {
      resolvedOptions.include = resolveInclude(resolvedOptions.include);
    }

    console.log(`Calling ${model}.${method} with options:`, resolvedOptions);
    const result = await models[model][method](resolvedOptions);
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
