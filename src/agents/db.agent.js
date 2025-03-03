const { openaiChat } = require("../config/openai.config");
const { getDatabaseContext } = require("../services/db/getDbContext.service");
const { executeQuery } = require("../services/db/executeQuery.service");

/**
 * Relational Database Management Agent.
 *
 * This agent converts any natural language query into a precise Sequelize query.
 * It supports complex queries that may include nested includes, advanced conditions,
 * grouping, ordering, and aggregations.
 *
 * Process:
 * 1. Validates the natural language description.
 * 2. Retrieves the current database schema summary for context.
 * 3. Constructs system and user messages with the schema details.
 * 4. Invokes the language model to generate a structured JSON response with a Sequelize query.
 * 5. Parses the response and executes the generated Sequelize query.
 *
 * Expected JSON format from the model:
 * {
 *   "sequelizeQuery": {
 *     "model": "User",         // The name of the Sequelize model (e.g., "User", "Organization")
 *     "method": "findAll",       // The Sequelize method to use (e.g., "findAll", "findOne")
 *     "options": {               // Query options including where, include, group, order, limit, etc.
 *       "where": { "name": { "$like": "%John%" } },
 *       "include": [{ "model": "Message", "attributes": ["id", "content"] }],
 *       "group": ["User.id"],
 *       "order": [["created_at", "DESC"]],
 *       "limit": 5
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
    const dbContext = await getDatabaseContext();

    // Construct system and user messages with an enhanced schema context.
    const systemMessage = {
      role: "system",
      content: `Sequelize Models Summary:\n${dbContext}
You are a Sequelize expert and a database management agent.
Convert the following natural language description into a precise Sequelize query.
The query may be complex and include nested includes, advanced where conditions, grouping, ordering, and aggregations.
Generate a JSON object with a key "sequelizeQuery" that includes:
  - model: the name of the model to query (e.g., "User", "Organization")
  - method: the Sequelize method to use (e.g., "findAll", "findOne")
  - options: an object with query options (for example, a "where" clause, include, group, order, limit, etc.)
Your answer must be a valid JSON object only (no extra text).
Example: {"sequelizeQuery": {"model": "User", "method": "findAll", "options": {"where": {"name": {"$like": "%John%"}}, "include": [{"model": "Message", "attributes": ["id", "content"]}], "group": ["User.id"], "order": [["created_at", "DESC"]], "limit": 5}}}`,
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
                  "The query options to pass to the Sequelize method (e.g., { where: { name: { '$like': '%John%' } }, include: [ ... ], group: [...], order: [...], limit: 5 }).",
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

    // Parse the JSON content from the response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(result.content);
    } catch (parseError) {
      throw new Error(
        "Error parsing language model response: " + parseError.message
      );
    }

    if (!parsedResponse.sequelizeQuery) {
      throw new Error(
        "The response from the language model does not contain 'sequelizeQuery'."
      );
    }

    const queryObject = parsedResponse.sequelizeQuery;
    console.log("Generated query object:", queryObject);

    const queryResult = await executeQuery(queryObject);
    console.log("Final query result:", queryResult);
    return queryResult;
  } catch (error) {
    console.error("Error in databaseManagementAgent:", error);
    throw error;
  }
}

module.exports = { databaseManagementAgent };
