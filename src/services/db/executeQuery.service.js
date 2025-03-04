const sequelize = require("../../config/sequelize.config");

/**
 * Executes a raw SQL query using Sequelize.
 *
 * @param {object} queryObject - An object containing:
 *    - sqlQuery: string, the raw SQL query to execute.
 * @returns {Promise<any>} The result of the query.
 */
async function executeQuery(queryObject) {
  try {
    if (!queryObject.sqlQuery || typeof queryObject.sqlQuery !== "string") {
      throw new Error(
        "Invalid query object. Expected property 'sqlQuery' of type string."
      );
    }
    console.log("Executing raw SQL query:", queryObject.sqlQuery);
    const [results, metadata] = await sequelize.query(queryObject.sqlQuery);
    console.log("Raw SQL query executed successfully. Result:", results);
    return results;
  } catch (error) {
    console.error("Error executing raw SQL query:", error);
    throw error;
  }
}

module.exports = { executeQuery };
