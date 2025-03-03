const { openaiChat } = require("../config/openai.config");
const {
  getDatabaseSchemaSummary,
  executeSequelizeQuery,
} = require("../services/db/relationalQueryAgent.service");

/**
 * Relational Database Management Agent.
 *
 * This agent is responsible for managing the relational database by:
 * - Generating Sequelize queries from natural language descriptions.
 * - Executing the generated queries.
 *
 * Process:
 * 1. Validates the provided natural language description.
 * 2. Retrieves the current database schema summary to supply context.
 * 3. Constructs system and user messages that include the schema details.
 * 4. Invokes the language model to generate a structured JSON response with a Sequelize query.
 * 5. Executes the generated Sequelize query and returns the result.
 *
 * Expected JSON format from the model:
 * {
 *   "sequelizeQuery": {
 *     "model": "User",         // The name of the Sequelize model (e.g., "User", "Organization")
 *     "method": "findAll",       // The Sequelize method to use (e.g., "findAll", "findOne")
 *     "options": {               // Query options (e.g., a "where" clause)
 *       "where": { "name": "John" }
 *     }
 *   }
 * }
 *
 * @param {string} userPrompt - The natural language description of the desired database task.
 * @returns {Promise<any>} The result of the executed Sequelize query.
 */
async function databaseManagementAgent(userPrompt) {
  console.log("Entering databaseManagementAgent with userPrompt:", userPrompt);
  try {
    if (!userPrompt || typeof userPrompt !== "string") {
      throw new Error("Invalid user prompt provided.");
    }

    console.log("Retrieving database schema summary...");
    const schemaSummary = await getDatabaseSchemaSummary();

    // Construct system and user messages with the schema context.
    const systemMessage = {
      role: "system",
      content: `Sequelize Models Summary:\n${schemaSummary}
You are a Sequelize expert and a database management agent.
Convert the following natural language description into a precise Sequelize query.
Generate a JSON object with a key "sequelizeQuery" that includes:
  - model: the name of the model to query (e.g., "User", "Organization")
  - method: the Sequelize method to use (e.g., "findAll", "findOne")
  - options: an object with the query options (for example, a "where" clause)
Your answer must be a valid JSON object only (no extra text).
Example: {"sequelizeQuery": {"model": "User", "method": "findAll", "options": {"limit": 5}}}`,
    };

    const userMessage = {
      role: "user",
      content: `Description: ${userPrompt}`,
    };

    console.log("Invoking language model with system and user messages...");
    const result = await openaiChat.invoke([systemMessage, userMessage], {
      model: "o3-mini",
      max_tokens: 5000,
      max_completion_tokens: 5000,
      reasoningEffort: "high",
      jsonSchema: {
        type: "object",
        properties: {
          sequelizeQuery: {
            type: "object",
            properties: {
              model: {
                type: "string",
                description:
                  "The name of the Sequelize model to query (e.g., 'User', 'Organization').",
              },
              method: {
                type: "string",
                description:
                  "The Sequelize method to use (e.g., 'findAll', 'findOne').",
              },
              options: {
                type: "object",
                description:
                  "The query options to pass to the Sequelize method (e.g., { where: { name: 'John' } }).",
              },
            },
            required: ["model", "method"],
            additionalProperties: true,
          },
        },
        additionalProperties: false,
        required: ["sequelizeQuery"],
      },
    });
    console.log("Received result from language model:", result);

    if (!result.sequelizeQuery) {
      throw new Error(
        "The response from the language model does not contain 'sequelizeQuery'."
      );
    }

    const queryObject = result.sequelizeQuery;
    console.log("Generated query object:", queryObject);

    const queryResult = await executeSequelizeQuery(queryObject);
    console.log("Final query result:", queryResult);
    return queryResult;
  } catch (error) {
    console.error("Error in databaseManagementAgent:", error);
    throw error;
  }
}

module.exports = { databaseManagementAgent };
