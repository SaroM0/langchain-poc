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
// Nodo: metadataCheckNode
// -------------------------------------------------------------------------
async function metadataCheckNode(state) {
  // Extraer la consulta del usuario (primer mensaje)
  const userQuery = state.messages[0].content;
  // Obtener el esquema completo de la base de datos
  const dbContext = await getDatabaseContext();

  const prompt = `You are an expert SQL assistant. Given the following complete database schema summary:
${dbContext}

And the user query:
"${userQuery}"

Determine if additional detailed metadata from any table is required to generate an accurate SQL SELECT query.
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
// Nodo: metadataQueryNode
// -------------------------------------------------------------------------
async function metadataQueryNode(state) {
  if (!state.additionalTables || state.additionalTables.length === 0) {
    return state;
  }
  for (const tableName of state.additionalTables) {
    // Construir un prompt para que el modelo genere la consulta que obtenga metadata detallada de la tabla.
    const prompt = `You are a SQL expert. Given the table "${tableName}" from the database, generate a SQL query that retrieves detailed metadata about the table (such as column names, data types, and notes). Your answer should be only the SQL query.`;
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
    console.log(
      `[metadataQueryNode] Generated metadata query for ${tableName}: ${metadataSqlQuery}`
    );
    // Ejecutar la consulta para obtener la metadata.
    let metadataResult;
    try {
      metadataResult = await executeQuery({ sqlQuery: metadataSqlQuery });
    } catch (error) {
      metadataResult = `Error retrieving metadata for ${tableName}: ${error.message}`;
    }
    // Agregar la metadata al estado.
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
// Nodo: sqlAgentNode
// -------------------------------------------------------------------------
async function sqlAgentNode(state) {
  // Extraer la consulta del usuario (primer mensaje)
  const userQuery = state.messages[0].content;
  console.log("[sqlAgentNode] Received user query:", userQuery);

  // Obtener el esquema completo
  const dbContext = await getDatabaseContext();

  // Concatenar cualquier metadata adicional (mensajes que comienzan con "Metadata for")
  let metadataContext = "";
  for (const msg of state.messages) {
    if (msg.content.startsWith("Metadata for")) {
      metadataContext += msg.content + "\n";
    }
  }

  // Construir el prompt final para generar la consulta SQL compleja
  const systemMessage = {
    role: "system",
    content: `Database Schema Summary:
  ${dbContext}
  
  ${metadataContext}
  
  You are a SQL expert with deep knowledge of MySQL. Your task is to convert the following natural language description into a precise, syntactically correct raw SQL SELECT query for MySQL.
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
// Nodo: executeSQLTool
// -------------------------------------------------------------------------
async function executeSQLTool(state) {
  const lastMessage = state.messages[state.messages.length - 1];
  const sqlQuery = lastMessage.content;
  console.log("[executeSQLTool] Executing SQL query:", sqlQuery);
  const result = await executeQuery({ sqlQuery });
  console.log("[executeSQLTool] Query execution result:", result);
  state.messages.push(new AIMessage(JSON.stringify(result)));
  return state;
}

// -------------------------------------------------------------------------
// Construcción del StateGraph del agente
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
// Guardar el estado en memoria y compilar el StateGraph
// -------------------------------------------------------------------------
const checkpointer = new MemorySaver();
const sqlAgent = sqlAgentStateGraph.compile({ checkpointer });

// -------------------------------------------------------------------------
// Función de conveniencia para invocar el agente SQL
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
