const { AIMessage, HumanMessage } = require("@langchain/core/messages");
const { StateGraph } = require("@langchain/langgraph");
const {
  MemorySaver,
  Annotation,
  messagesStateReducer,
} = require("@langchain/langgraph");
const { openaiChat } = require("../config/openai.config");
const { executeQuery } = require("../services/db/executeQuery.service");
const {
  structureFullResults,
  extractDateRange,
} = require("../services/semantic/semanticSearch.service");
const { listPineconeIndexes } = require("../config/pinecone.config");

// -------------------------------------------------------------------------
// Nodo: getChannelsNode
// Ejecuta una consulta SQL para obtener la lista de canales disponibles.
// -------------------------------------------------------------------------
async function getChannelsNode(state) {
  const sqlQuery = "SELECT id, name FROM channel";
  let channelsResult = await executeQuery({ sqlQuery });
  state.channels = channelsResult || [];
  state.messages.push(
    new AIMessage("Channels: " + JSON.stringify(state.channels))
  );
  return state;
}

// -------------------------------------------------------------------------
// Nodo: vectorizedChannelsNode
// Filtra los canales disponibles para quedarse solo con aquellos que tienen un índice en Pinecone.
// -------------------------------------------------------------------------
async function vectorizedChannelsNode(state) {
  let availableIndexes = [];
  try {
    availableIndexes = await listPineconeIndexes();
  } catch (error) {
    state.messages.push(
      new AIMessage("Error fetching Pinecone indexes: " + error.message)
    );
    availableIndexes = [];
  }
  // availableIndexes debe ser un arreglo de nombres (p.ej., ["channel-13", ...])
  if (!state.channels) {
    throw new Error(
      "No channels available in state. Ensure getChannelsNode has been executed."
    );
  }
  const vectorized = state.channels.filter((ch) =>
    availableIndexes.includes(`channel-${ch.id}`)
  );
  state.vectorizedChannels = vectorized;
  state.messages.push(
    new AIMessage("Vectorized Channels: " + JSON.stringify(vectorized))
  );
  return state;
}

// -------------------------------------------------------------------------
// Nodo: channelSelectionNode
// Utiliza el LLM para determinar cuáles canales (vectorizados) son relevantes para la consulta.
// -------------------------------------------------------------------------
async function channelSelectionNode(state) {
  const channelsList = state.vectorizedChannels || state.channels;
  const userQuery = state.messages[0].content;
  const prompt = `You are an expert in analyzing database queries. Given the following list of channels (each with an "id" and "name"):
${JSON.stringify(channelsList, null, 2)}

And the user query:
"${userQuery}"

Determine which channel IDs are relevant for answering the query. Return your answer strictly as a JSON object with a key "relevantChannels" containing an array of channel IDs (as strings). If all channels are relevant, return all their IDs. If none are relevant, return an empty array.`;
  const response = await openaiChat.invoke(
    [{ role: "user", content: prompt }],
    {
      model: "o3-mini",
      max_tokens: 1000,
      jsonSchema: {
        type: "object",
        properties: {
          relevantChannels: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
        required: ["relevantChannels"],
      },
    }
  );
  let parsed;
  try {
    parsed = JSON.parse(response.content);
  } catch (e) {
    throw new Error("Error parsing channel selection response: " + e.message);
  }
  state.relevantChannels = parsed.relevantChannels;
  state.messages.push(
    new AIMessage(
      "Relevant Channels: " + JSON.stringify(parsed.relevantChannels)
    )
  );
  return state;
}

// -------------------------------------------------------------------------
// Nodo: semanticSearchNode
// Realiza la búsqueda semántica en cada canal relevante usando structureFragments.
// -------------------------------------------------------------------------
async function semanticSearchNode(state) {
  const userQuery = state.messages[0].content;
  let channelsToSearch = state.relevantChannels;
  if (!channelsToSearch || channelsToSearch.length === 0) {
    if (!state.channels) {
      throw new Error(
        "No channels found in state. Ensure getChannelsNode has been executed."
      );
    }
    channelsToSearch = state.channels.map((ch) => String(ch.id));
  }
  state.searchResults = {};

  // Extract the date range from the user query
  // Extract the date range from the user query
  const dateRange = (await extractDateRange(userQuery)) || {};
  let filter = {};
  if (dateRange.startDate && dateRange.endDate) {
    // Convertir las fechas ISO a timestamps (milisegundos)
    const startTimestamp = new Date(dateRange.startDate).getTime();
    const endTimestamp = new Date(dateRange.endDate).getTime();
    filter = {
      created_at: {
        $gte: startTimestamp,
        $lte: endTimestamp,
      },
    };
  }

  for (const channelId of channelsToSearch) {
    console.log(
      `[semanticSearchNode] Performing semantic search for channel ${channelId} with filter: ${JSON.stringify(
        filter
      )}`
    );
    try {
      const fullResults = await structureFullResults(
        userQuery,
        channelId,
        10,
        filter
      );
      console.log(
        `[semanticSearchNode] Full results for channel ${channelId}: ${JSON.stringify(
          fullResults,
          null,
          2
        )}`
      );
      state.searchResults[channelId] = fullResults;
      state.messages.push(
        new AIMessage(
          `Full results for channel ${channelId}: ${JSON.stringify(
            fullResults,
            null,
            2
          )}`
        )
      );
    } catch (error) {
      state.messages.push(
        new AIMessage(
          `Error in semantic search for channel ${channelId}: ${error.message}`
        )
      );
    }
  }
  return state;
}

// -------------------------------------------------------------------------
// Nodo: aggregationNode
// Consolida la información de los canales relevantes en un único contexto.
// -------------------------------------------------------------------------
async function aggregationNode(state) {
  const searchResults = state.searchResults;
  let aggregatedContext = "";
  for (const channelId in searchResults) {
    aggregatedContext += `Channel ${channelId}:\n${JSON.stringify(
      searchResults[channelId],
      null,
      2
    )}\n\n`;
  }
  state.aggregatedContext = aggregatedContext;
  state.messages.push(
    new AIMessage("Aggregated Context:\n" + aggregatedContext)
  );
  return state;
}

// -------------------------------------------------------------------------
// Nodo: rephraseAnswerNode
// Utiliza el LLM para convertir el contexto agregado en una respuesta natural.
// -------------------------------------------------------------------------
async function rephraseAnswerNode(state) {
  const aggregatedContext = state.aggregatedContext;
  const userQuery = state.messages[0].content;
  const prompt = `You are an expert in summarizing and rephrasing information.
Given the user query:
"${userQuery}"
and the following aggregated context:
"${aggregatedContext}"
Generate a natural, concise answer that provides the requested information in a conversational tone.
Your answer should be plain text (no JSON formatting).`;

  const response = await openaiChat.invoke(
    [{ role: "user", content: prompt }],
    {
      model: "o3-mini",
      max_tokens: 1500,
    }
  );
  const finalAnswer = response.content.trim();
  state.messages.push(new AIMessage(finalAnswer));
  return state;
}

// -------------------------------------------------------------------------
// Definición del State Annotation (incluye propiedades adicionales).
// -------------------------------------------------------------------------
const StateAnnotation = Annotation.Root({
  messages: Annotation({ reducer: messagesStateReducer }),
  channels: Annotation({ initial: [] }),
  vectorizedChannels: Annotation({ initial: [] }),
  relevantChannels: Annotation({ initial: [] }),
  searchResults: Annotation({ initial: {} }),
  aggregatedContext: Annotation({ initial: "" }),
  additionalTables: Annotation({ initial: [] }),
  metadata: Annotation({ initial: {} }),
});

// -------------------------------------------------------------------------
// Construcción del StateGraph del Semantic Agent
// -------------------------------------------------------------------------
const semanticAgentStateGraph = new StateGraph(StateAnnotation)
  .addNode("getChannels", getChannelsNode)
  .addNode("filterVectorizedChannels", vectorizedChannelsNode)
  .addNode("selectChannels", channelSelectionNode)
  .addNode("semanticSearch", semanticSearchNode)
  .addNode("aggregateResults", aggregationNode)
  .addNode("rephraseAnswer", rephraseAnswerNode)
  .addEdge("getChannels", "filterVectorizedChannels")
  .addEdge("filterVectorizedChannels", "selectChannels")
  .addEdge("selectChannels", "semanticSearch")
  .addEdge("semanticSearch", "aggregateResults")
  .addEdge("aggregateResults", "rephraseAnswer")
  .addEdge("__start__", "getChannels")
  .addEdge("rephraseAnswer", "__end__");

// Convertidor del gráfico a GraphExecutor
const semanticAgentGraph = semanticAgentStateGraph.compile();
const semanticMemorySaver = new MemorySaver({
  key: "semantic_agent",
  initialState: { metadata: {} },
});

// -------------------------------------------------------------------------
// Función de invocación del agente semántico
// -------------------------------------------------------------------------
async function invokeSemanticAgent(query, config = {}) {
  const inputs = {
    messages: [new HumanMessage(query)],
    metadata: config || {},
  };
  console.log("[invokeSemanticAgent] Starting with inputs:", JSON.stringify(inputs));
  try {
    const execConfig = { configurable: { saver: semanticMemorySaver } };
    if (config?.thread_id) {
      execConfig.configurable.sessionId = config.thread_id;
    }
    const response = await semanticAgentGraph.invoke(inputs, execConfig);
    
    // Return the last message from the agent
    const lastMessage = response.messages[response.messages.length - 1];
    const content = lastMessage?.content || "No response generated.";
    return content;
  } catch (error) {
    console.error("[invokeSemanticAgent] Error:", error);
    return "Error processing your request through the semantic agent: " + error.message;
  }
}

module.exports = { invokeSemanticAgent };
