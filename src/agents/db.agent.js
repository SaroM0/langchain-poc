const { openaiChat } = require("../config/openai.config");
const { getDatabaseContext } = require("../services/db/getDbContext.service");
const { executeQuery } = require("../services/db/executeQuery.service");

/**
 * Relational Database Management Agent.
 *
 * This agent converts a natural language query into a precise, syntactically correct raw SQL SELECT query.
 * It supports complex queries that may include filtering, grouping, ordering, and pagination.
 *
 * Process:
 * 1. Validates the natural language description.
 * 2. Retrieves the current database schema summary for context.
 * 3. Constructs system and user messages with the schema details and advanced NL2SQL guidelines.
 * 4. Invokes the language model to generate a structured JSON response with a raw SQL query.
 * 5. Parses the response and executes the generated SQL query.
 *
 * Expected JSON format from the model:
 * {
 *   "sqlQuery": "SELECT ... FROM ... WHERE ... GROUP BY ... ORDER BY ... LIMIT ..."
 * }
 *
 * @param {string} userPrompt - The natural language description of the desired database task.
 * @returns {Promise<any>} The result of the executed SQL query.
 */
async function databaseManagementAgent(userPrompt) {
  console.log("Entering databaseManagementAgent with userPrompt:", userPrompt);
  try {
    if (!userPrompt || typeof userPrompt !== "string") {
      throw new Error("Invalid user prompt provided.");
    }

    console.log("Retrieving database schema summary...");
    const dbContext = await getDatabaseContext();

    // Construye los mensajes del sistema y del usuario con pautas avanzadas de NL2SQL.
    const systemMessage = {
      role: "system",
      content: `Database Schema Summary:
${dbContext}

You are a SQL expert. Your task is to convert a natural language description into a precise, syntactically correct raw SQL SELECT query.
Guidelines:
1. The query must be a valid SELECT query that only retrieves data.
2. Use appropriate clauses for filtering, grouping, ordering, and pagination as needed.
3. Use the schema summary above to determine which tables and columns are relevant.
4. Your answer must be a valid JSON object with a single key "sqlQuery", whose value is the raw SQL query.
Example:
{"sqlQuery": "SELECT User.id, COUNT(Message.id) AS messageCount FROM User JOIN Message ON User.id = Message.userId GROUP BY User.id ORDER BY messageCount DESC LIMIT 5"}
Your answer must be a valid JSON object only (no extra text).`,
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
          sqlQuery: {
            type: "string",
            description: "A syntactically correct SQL SELECT query.",
          },
        },
        additionalProperties: false,
        required: ["sqlQuery"],
      },
    });
    console.log("Received result from language model:", result);

    // Parsear el contenido JSON de la respuesta.
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(result.content);
    } catch (parseError) {
      throw new Error(
        "Error parsing language model response: " + parseError.message
      );
    }

    if (!parsedResponse.sqlQuery) {
      throw new Error(
        "The response from the language model does not contain 'sqlQuery'."
      );
    }

    const queryObject = parsedResponse;
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
