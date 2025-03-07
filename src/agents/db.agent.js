const { AIMessage, HumanMessage } = require("@langchain/core/messages");
const { StateGraph } = require("@langchain/langgraph");
const {
  MemorySaver,
  Annotation,
  messagesStateReducer,
} = require("@langchain/langgraph");
const { openaiChat } = require("../config/openai.config");
const { getDatabaseContext } = require("../services/db/getDbContext.service");
const { executeQuery } = require("../services/db/executeQuery.service");

// In-memory cache for database schema
const schemaCache = {};

async function getCachedDatabaseContext() {
  if (!schemaCache.dbContext) {
    schemaCache.dbContext = await getDatabaseContext();
  }
  return schemaCache.dbContext;
}

// Helper function to summarize a block of context text.
async function summarizeContext(contextText) {
  const prompt = `You are an expert summarizer. Summarize the following information by extracting only the most relevant details in a concise manner:

"${contextText}"

Your answer should be plain text only, without any JSON formatting.`;
  const response = await openaiChat.invoke(
    [{ role: "user", content: prompt }],
    { model: "o3-mini", max_tokens: 500 }
  );
  return response.content.trim();
}

// Helper function to iteratively execute queries (up to maxIterations) until a non-empty result is obtained.
async function iterativeExecuteQuery(sqlQuery, maxIterations = 3) {
  let iteration = 0;
  let result = [];
  while (iteration < maxIterations) {
    try {
      result = await executeQuery({ sqlQuery });
      if (Array.isArray(result) && result.length > 0) break;
    } catch (error) {
      // Log error if necessary
    }
    iteration++;
  }
  return result;
}

// Helper function to ensure that a subquery does not return empty.
// If an empty result is obtained, it asks the model to generate a new query for that resource.
async function ensureNonEmptyResult(
  promptTemplate,
  contextVars,
  currentResult,
  maxRetries = 3
) {
  let retries = 0;
  let newResult = currentResult;
  while (
    Array.isArray(newResult) &&
    newResult.length === 0 &&
    retries < maxRetries
  ) {
    const prompt = promptTemplate(...contextVars);
    const response = await openaiChat.invoke(
      [{ role: "user", content: prompt }],
      { model: "o3-mini", max_tokens: 1000 }
    );
    let parsed;
    try {
      parsed = JSON.parse(response.content);
    } catch (e) {
      throw new Error("Error parsing iterative query response: " + e.message);
    }
    const newQuery =
      parsed.validationQueries &&
      parsed.validationQueries[0] &&
      parsed.validationQueries[0].sqlQuery;
    if (!newQuery) break;
    newResult = await iterativeExecuteQuery(newQuery);
    retries++;
  }
  return newResult;
}

// -------------------------------------------------------------------------
// Node: validationNode
// -------------------------------------------------------------------------
async function validationNode(state) {
  const userQuery = state.messages[0].content;
  const dbContext = await getCachedDatabaseContext();
  const prompt = `You are a SQL expert. Using only the following complete database schema summary:
${dbContext}

And the user's query:
"${userQuery}"

Identify any dynamic resources (such as specific table entries, field values, identifiers, etc.) mentioned in the query that need to be verified against the database.
Do NOT assume or hardcode any names, tables, or attributes that have not been validated.
Generate one or more SQL queries dynamically that can validate or retrieve the actual existing values for these resources.
Return your answer strictly as a JSON object with a single key "validationQueries" containing an array of objects, each with two keys: "description" and "sqlQuery".
If no validation is needed, return {"validationQueries": []}.`;

  const response = await openaiChat.invoke(
    [{ role: "user", content: prompt }],
    {
      model: "o3-mini",
      max_tokens: 1000,
      jsonSchema: {
        type: "object",
        properties: {
          validationQueries: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                sqlQuery: { type: "string" },
              },
              required: ["description", "sqlQuery"],
            },
          },
        },
        additionalProperties: false,
        required: ["validationQueries"],
      },
    }
  );
  let parsed;
  try {
    parsed = JSON.parse(response.content);
  } catch (e) {
    throw new Error("Error parsing validation node response: " + e.message);
  }
  state.validations = { queries: parsed.validationQueries, results: {} };
  for (const queryObj of parsed.validationQueries) {
    let result = await iterativeExecuteQuery(queryObj.sqlQuery);
    // If the result is empty, attempt to generate a new query for that resource.
    if (Array.isArray(result) && result.length === 0) {
      result = await ensureNonEmptyResult(
        (
          resource
        ) => `You are a SQL expert. The previous validation query for resource "${resource}" returned an empty result.
Please re-generate a new SQL query that verifies the existence of this resource in the database.
Return your answer as a JSON object with a key "validationQueries" containing an array with one object having keys "description" and "sqlQuery".`,
        [queryObj.description],
        result
      );
    }
    state.validations.results[queryObj.description] = result;
    state.messages.push(
      new AIMessage(
        `Validation - ${queryObj.description}: ${JSON.stringify(result)}`
      )
    );
  }
  return state;
}

// -------------------------------------------------------------------------
// Node: metadataCheckNode
// -------------------------------------------------------------------------
async function metadataCheckNode(state) {
  const userQuery = state.messages[0].content;
  const dbContext = await getCachedDatabaseContext();
  const prompt = `You are an expert SQL assistant. Using only the following complete database schema summary:
${dbContext}

And the user query:
"${userQuery}"

Determine if additional detailed metadata from any table (that already exists in the provided schema) is required to generate an accurate SQL SELECT query.
Do not invent or refer to any tables that are not present in the provided schema.
Return your answer strictly as a JSON object with a single key "additionalTables" containing an array of table names.
If no additional metadata is needed, return {"additionalTables": []}.`;

  const response = await openaiChat.invoke(
    [{ role: "user", content: prompt }],
    {
      model: "o3-mini",
      max_tokens: 1000,
      jsonSchema: {
        type: "object",
        properties: {
          additionalTables: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
        required: ["additionalTables"],
      },
    }
  );
  let parsed;
  try {
    parsed = JSON.parse(response.content);
  } catch (e) {
    throw new Error("Error parsing metadata check response: " + e.message);
  }
  state.additionalTables = parsed.additionalTables;
  state.messages.push(
    new AIMessage(
      `Additional tables needed: ${JSON.stringify(parsed.additionalTables)}`
    )
  );
  return state;
}

// -------------------------------------------------------------------------
// Node: metadataQueryNode
// -------------------------------------------------------------------------
async function metadataQueryNode(state) {
  if (!state.additionalTables || state.additionalTables.length === 0)
    return state;
  for (const tableName of state.additionalTables) {
    const prompt = `You are a SQL expert. Given the table "${tableName}" from the provided database schema, generate a SQL query that retrieves detailed metadata about the table (such as column names, data types, and notes). Use only the table that exists in the schema; do not invent or assume additional tables. Your answer should be only the SQL query.`;
    const response = await openaiChat.invoke(
      [{ role: "user", content: prompt }],
      { model: "o3-mini", max_tokens: 500, jsonSchema: { type: "string" } }
    );
    const metadataSqlQuery = response.content.trim();
    let metadataResult;
    try {
      metadataResult = await executeQuery({ sqlQuery: metadataSqlQuery });
    } catch (error) {
      metadataResult = `Error retrieving metadata for ${tableName}: ${error.message}`;
    }
    state.messages.push(
      new AIMessage(
        `Metadata for ${tableName}: ${JSON.stringify(metadataResult)}`
      )
    );
    if (!state.metadata) state.metadata = {};
    state.metadata[tableName] = metadataResult;
  }
  return state;
}

// -------------------------------------------------------------------------
// Node: inspectionNode
// -------------------------------------------------------------------------
async function inspectionNode(state) {
  const userQuery = state.messages[0].content;
  const dbContext = await getCachedDatabaseContext();
  const prompt = `You are a SQL expert. Based on the following complete database schema summary:
${dbContext}

And the user's query:
"${userQuery}"

Identify any fields or values (for example, dynamic entries such as reactions, status codes, etc.) that need to be inspected to retrieve the actual distinct values present in the database.
Generate one or more SQL queries dynamically that retrieve the distinct values for those fields.
Return your answer strictly as a JSON object with a single key "inspectionQueries" containing an array of objects, each with keys "description" and "sqlQuery".
If no inspection is needed, return {"inspectionQueries": []}.`;

  const response = await openaiChat.invoke(
    [{ role: "user", content: prompt }],
    {
      model: "o3-mini",
      max_tokens: 1000,
      jsonSchema: {
        type: "object",
        properties: {
          inspectionQueries: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                sqlQuery: { type: "string" },
              },
              required: ["description", "sqlQuery"],
            },
          },
        },
        additionalProperties: false,
        required: ["inspectionQueries"],
      },
    }
  );
  let parsed;
  try {
    parsed = JSON.parse(response.content);
  } catch (e) {
    throw new Error("Error parsing inspection node response: " + e.message);
  }
  state.inspections = { queries: parsed.inspectionQueries, results: {} };
  for (const queryObj of parsed.inspectionQueries) {
    let result = await iterativeExecuteQuery(queryObj.sqlQuery);
    // If the result is still empty, re-request a new query from the model.
    if (Array.isArray(result) && result.length === 0) {
      result = await ensureNonEmptyResult(
        (
          ...args
        ) => `You are a SQL expert. The inspection query for "${args[0]}" returned an empty result.
Please re-generate a SQL query to inspect this field and retrieve distinct values.
Return your answer as a JSON object with a key "inspectionQueries" containing an array with one object having keys "description" and "sqlQuery".`,
        [queryObj.description],
        result
      );
    }
    state.inspections.results[queryObj.description] = result;
    state.messages.push(
      new AIMessage(
        `Inspection - ${queryObj.description}: ${JSON.stringify(result)}`
      )
    );
  }
  return state;
}

// -------------------------------------------------------------------------
// Node: summarizeContextNode
// This node summarizes accumulated context to reduce total length.
async function summarizeContextNode(state) {
  let contextToSummarize = "";
  for (const msg of state.messages) {
    if (
      msg.content.startsWith("Validation -") ||
      msg.content.startsWith("Metadata for") ||
      msg.content.startsWith("Inspection -")
    ) {
      contextToSummarize += msg.content + "\n";
    }
  }
  // Only summarize if context is lengthy (e.g., over 1000 characters)
  if (contextToSummarize.length < 1000) {
    return state;
  }
  const summary = await summarizeContext(contextToSummarize);
  state.summarizedContext = summary;
  state.messages.push(new AIMessage("Summarized Context:\n" + summary));
  return state;
}

// -------------------------------------------------------------------------
// Node: sqlAgentNode
// -------------------------------------------------------------------------
async function sqlAgentNode(state) {
  const userQuery = state.messages[0].content;
  const dbContext = await getCachedDatabaseContext();
  const summarizedContext = state.summarizedContext || "";
  let errorContext = "";
  for (const msg of state.messages) {
    if (msg.content.startsWith("Error executing SQL query:")) {
      errorContext += msg.content + "\n";
    }
  }
  const validationContext = state.validations
    ? `Validated Data: ${JSON.stringify(state.validations, null, 2)}`
    : "";
  const inspectionContext = state.inspections
    ? `Inspected Data: ${JSON.stringify(state.inspections, null, 2)}`
    : "";
  const systemMessage = {
    role: "system",
    content: `Database Schema Summary:
${dbContext}

Summarized Context:
${summarizedContext}

Validation Context:
${validationContext}

Inspection Context:
${inspectionContext}

${errorContext}

You are a SQL expert with deep knowledge of MySQL. Your task is to convert the following natural language description into a precise, syntactically correct raw SQL SELECT query for MySQL.
Important: Only use the tables, columns, and the validated/inspected data provided above. Do NOT assume any names, tables, or attributes that have not been verified.
Guidelines:
1. The query must be a valid SELECT query that only retrieves data.
2. Use appropriate clauses for filtering, grouping, ordering, and pagination as needed.
3. Base your query solely on the schema summary, metadata, and the validated/inspected data.
4. Enclose table and column names in backticks (\`) when necessary.
5. Return your answer as a valid JSON object with a single key "sqlQuery" containing the SQL query.
Example:
{"sqlQuery": "SELECT \`User\`.id, COUNT(\`Message\`.id) AS messageCount FROM \`User\` JOIN \`Message\` ON \`User\`.id = \`Message\`.userId GROUP BY \`User\`.id ORDER BY messageCount DESC LIMIT 5"}
Your answer must be a valid JSON object only (no extra text).`,
  };
  const userMessage = {
    role: "user",
    content: `Description: ${userQuery}`,
  };
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
  let parsedResponse;
  try {
    parsedResponse = JSON.parse(result.content);
  } catch (e) {
    throw new Error("Error parsing language model response: " + e.message);
  }
  if (!parsedResponse.sqlQuery) {
    throw new Error("The response does not contain 'sqlQuery'.");
  }
  console.log("[sqlAgentNode] Generated SQL query:", parsedResponse.sqlQuery);
  state.messages.push(new AIMessage(parsedResponse.sqlQuery));
  return state;
}

// -------------------------------------------------------------------------
// Node: logicalValidationNode
// This new node performs logical validation of the generated SQL query.
async function logicalValidationNode(state) {
  const userQuery = state.messages[0].content;
  const lastMessage = state.messages[state.messages.length - 1];
  const sqlQuery = lastMessage.content;

  // Security check: ensure the query is a SELECT query.
  if (!/^SELECT\s/i.test(sqlQuery.trim())) {
    throw new Error("Only SELECT queries are allowed. Query blocked.");
  }

  const prompt = `You are a SQL expert. The user query is: "${userQuery}" and the generated SQL query is: "${sqlQuery}". 
Verify if this SQL query logically meets all the conditions specified by the user.
If the query is logically correct and complete, reply with a JSON object: {"validation": "VALID"}.
If there are missing conditions or logical issues, reply with a JSON object containing a key "corrections" describing the issues and a key "newQuery" with the corrected SQL query.`;

  const response = await openaiChat.invoke(
    [{ role: "user", content: prompt }],
    {
      model: "o3-mini",
      max_tokens: 1000,
      jsonSchema: {
        type: "object",
        properties: {
          validation: { type: "string" },
        },
        additionalProperties: true,
        required: ["validation"],
      },
    }
  );
  let parsed;
  try {
    parsed = JSON.parse(response.content);
  } catch (e) {
    throw new Error("Error parsing logical validation response: " + e.message);
  }
  if (parsed.validation !== "VALID") {
    if (parsed.newQuery) {
      state.messages.push(
        new AIMessage(
          `Logical Validation Correction: ${JSON.stringify(parsed)}`
        )
      );
      // Replace the last query with the corrected one.
      state.messages.push(new AIMessage(parsed.newQuery));
    } else {
      throw new Error(
        "Logical validation failed without providing a new query."
      );
    }
  } else {
    state.messages.push(new AIMessage("Logical Validation: VALID"));
  }
  return state;
}

// -------------------------------------------------------------------------
// Node: executeSQLTool
// -------------------------------------------------------------------------
async function executeSQLTool(state) {
  const lastMessage = state.messages[state.messages.length - 1];
  const sqlQuery = lastMessage.content;
  console.log("[executeSQLTool] Executing SQL query:", sqlQuery);

  // Security check: only allow SELECT queries.
  if (!/^SELECT\s/i.test(sqlQuery.trim())) {
    throw new Error("Only SELECT queries are allowed. Query blocked.");
  }

  try {
    const result = await executeQuery({ sqlQuery });
    console.log("[executeSQLTool] Query execution result:", result);
    state.messages.push(new AIMessage(JSON.stringify(result)));
    return state;
  } catch (error) {
    console.log("[executeSQLTool] Error executing SQL query:", error);
    state.messages.push(
      new AIMessage(`Error executing SQL query: ${error.message}`)
    );
    if (!state.retryCount) {
      state.retryCount = 0;
    }
    if (state.retryCount < 3) {
      state.retryCount++;
      let errorPrompt = "";
      const lowerMsg = error.message.toLowerCase();
      if (lowerMsg.includes("syntax")) {
        errorPrompt = `The previous SQL query had a syntax error: "${error.message}". Please generate a new query with correct syntax.`;
      } else if (lowerMsg.includes("unknown column")) {
        errorPrompt = `The previous SQL query referenced an unknown column. Correct the query using the validated schema.`;
      } else {
        errorPrompt = `The previous SQL query failed with error: "${error.message}". Please generate a new query considering this error.`;
      }
      state.messages.push(new HumanMessage(errorPrompt));
      // Regenerate the query by calling logicalValidationNode to trigger regeneration.
      const newState = await logicalValidationNode(state);
      return await executeSQLTool(newState);
    } else {
      state.messages.push(
        new AIMessage(
          "Maximum retry attempts reached. Query execution aborted."
        )
      );
      return state;
    }
  }
}

// -------------------------------------------------------------------------
// Node: rephraseAnswerNode
// This node uses the executed query result to produce a natural language answer.
async function rephraseAnswerNode(state) {
  const lastResultMessage = state.messages[state.messages.length - 1].content;
  // Check for empty results.
  if (lastResultMessage === "[]" || lastResultMessage.trim() === "") {
    state.messages.push(new AIMessage("No data found for your query."));
    return state;
  }
  const userQuery = state.messages[0].content;
  const prompt = `You are an expert at analyzing technical data and transforming it into a comprehensive natural language explanation.
Given the user query:
"${userQuery}"
and the following detailed SQL query execution result:
"${lastResultMessage}"
Generate a thorough and detailed answer in plain text that explains all the relevant findings, including key statistics, patterns, and any notable data points. Your explanation should cover every important aspect of the result and provide complete context in a conversational tone.
Your answer must be plain text only, without any JSON formatting or code blocks.`;
  const response = await openaiChat.invoke(
    [{ role: "user", content: prompt }],
    { model: "o3-mini", max_tokens: 1500 }
  );
  const finalAnswer = response.content.trim();
  state.messages.push(new AIMessage(finalAnswer));
  return state;
}

// -------------------------------------------------------------------------
// Construct the StateGraph of the agent
// -------------------------------------------------------------------------
const sqlAgentStateGraph = new StateGraph(
  Annotation.Root({
    messages: Annotation({ reducer: messagesStateReducer }),
  })
)
  .addNode("validation", validationNode)
  .addNode("metadataCheck", metadataCheckNode)
  .addNode("metadataQuery", metadataQueryNode)
  .addNode("inspection", inspectionNode)
  .addNode("summarizeContext", summarizeContextNode)
  .addNode("agent", sqlAgentNode)
  .addNode("logicalValidation", logicalValidationNode)
  .addNode("execute", executeSQLTool)
  .addNode("rephrase", rephraseAnswerNode)
  .addEdge("__start__", "validation")
  .addEdge("validation", "metadataCheck")
  .addEdge("metadataCheck", "metadataQuery")
  .addEdge("metadataQuery", "inspection")
  .addEdge("inspection", "summarizeContext")
  .addEdge("summarizeContext", "agent")
  .addEdge("agent", "logicalValidation")
  .addEdge("logicalValidation", "execute")
  .addEdge("execute", "rephrase");

// -------------------------------------------------------------------------
// Save state in memory and compile the StateGraph
// -------------------------------------------------------------------------
const checkpointer = new MemorySaver();
const sqlAgent = sqlAgentStateGraph.compile({ checkpointer });

// -------------------------------------------------------------------------
// Convenience function to invoke the SQL agent
// -------------------------------------------------------------------------
async function invokeSQLAgent(query, config = {}) {
  const initialState = { messages: [new HumanMessage(query)] };
  const finalState = await sqlAgent.invoke(initialState, {
    configurable: { thread_id: "default-thread", ...config },
  });
  const finalMessage = finalState.messages[finalState.messages.length - 1];
  return finalMessage.content;
}

module.exports = { invokeSQLAgent };
