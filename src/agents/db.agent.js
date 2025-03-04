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

// -------------------------------------------------------------------------
// Node: metadataCheckNode
// -------------------------------------------------------------------------
async function metadataCheckNode(state) {
  // Extract the user's query (first message)
  const userQuery = state.messages[0].content;
  // Get the complete database schema summary from the loaded file
  const dbContext = await getDatabaseContext();

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
  if (!state.additionalTables || state.additionalTables.length === 0) {
    return state;
  }
  for (const tableName of state.additionalTables) {
    // Construct a prompt for the model to generate the query that retrieves detailed metadata for the table.
    // The prompt instructs the model to use only the provided table and not invent new ones.
    const prompt = `You are a SQL expert. Given the table "${tableName}" from the provided database schema, generate a SQL query that retrieves detailed metadata about the table (such as column names, data types, and notes). Use only the table that exists in the schema; do not invent or assume additional tables. Your answer should be only the SQL query.`;
    const response = await openaiChat.invoke(
      [{ role: "user", content: prompt }],
      {
        model: "o3-mini",
        max_tokens: 500,
        jsonSchema: {
          type: "string",
        },
      }
    );
    const metadataSqlQuery = response.content.trim();
    // Execute the query to obtain the metadata.
    let metadataResult;
    try {
      metadataResult = await executeQuery({ sqlQuery: metadataSqlQuery });
    } catch (error) {
      metadataResult = `Error retrieving metadata for ${tableName}: ${error.message}`;
    }
    // Append the metadata to the state.
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
// Node: sqlAgentNode
// -------------------------------------------------------------------------
async function sqlAgentNode(state) {
  // Extract the user's query (first message)
  const userQuery = state.messages[0].content;

  // Get the complete schema from the loaded file
  const dbContext = await getDatabaseContext();

  // Concatenate any additional metadata (messages starting with "Metadata for")
  let metadataContext = "";
  for (const msg of state.messages) {
    if (msg.content.startsWith("Metadata for")) {
      metadataContext += msg.content + "\n";
    }
  }

  // Include any error context from previous failed attempts
  let errorContext = "";
  for (const msg of state.messages) {
    if (msg.content.startsWith("Error executing SQL query:")) {
      errorContext += msg.content + "\n";
    }
  }

  const systemMessage = {
    role: "system",
    content: `Database Schema Summary:
${dbContext}

${metadataContext}

${errorContext}

You are a SQL expert with deep knowledge of MySQL. Your task is to convert the following natural language description into a precise, syntactically correct raw SQL SELECT query for MySQL.
Important: Only use the tables and columns provided in the schema summary above. Do not invent or create any new tables.
Guidelines:
1. The query must be a valid SELECT query that only retrieves data.
2. Use appropriate clauses for filtering, grouping, ordering, and pagination as needed.
3. Use the schema summary above and any additional metadata to determine which tables and columns are relevant.
4. To avoid syntax errors, enclose table names and column names in backticks (\`) when necessary (e.g., \`user\`, \`Message\`).
5. Your answer must be a valid JSON object with a single key "sqlQuery", whose value is the raw SQL query.
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
// Node: executeSQLTool
// -------------------------------------------------------------------------
async function executeSQLTool(state) {
  const lastMessage = state.messages[state.messages.length - 1];
  const sqlQuery = lastMessage.content;
  console.log("[executeSQLTool] Executing SQL query:", sqlQuery);
  try {
    const result = await executeQuery({ sqlQuery });
    console.log("[executeSQLTool] Query execution result:", result);
    state.messages.push(new AIMessage(JSON.stringify(result)));
    return state;
  } catch (error) {
    console.log("[executeSQLTool] Error executing SQL query:", error);
    // Append error message to state
    state.messages.push(
      new AIMessage(`Error executing SQL query: ${error.message}`)
    );
    // Initialize retry count if not present
    if (!state.retryCount) {
      state.retryCount = 0;
    }
    // Retry up to 3 times
    if (state.retryCount < 3) {
      state.retryCount++;
      // Add a new HumanMessage with the error context to ask for a revised query
      state.messages.push(
        new HumanMessage(
          `The previous SQL query failed with error: ${error.message}. Please generate a new query considering this error, and only use the tables provided in the schema.`
        )
      );
      // Re-run the SQL generation node to obtain a new query
      const newState = await sqlAgentNode(state);
      // Attempt to execute the new query
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
// Construct the StateGraph of the agent
// -------------------------------------------------------------------------
const sqlAgentStateGraph = new StateGraph(
  Annotation.Root({
    messages: Annotation({ reducer: messagesStateReducer }),
  })
)
  .addNode("metadataCheck", metadataCheckNode)
  .addNode("metadataQuery", metadataQueryNode)
  .addNode("agent", sqlAgentNode)
  .addNode("execute", executeSQLTool)
  .addEdge("__start__", "metadataCheck")
  .addEdge("metadataCheck", "metadataQuery")
  .addEdge("metadataQuery", "agent")
  .addEdge("agent", "execute");

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
