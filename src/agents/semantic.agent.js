import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { StateGraph } from "@langchain/langgraph";
import {
  MemorySaver,
  Annotation,
  messagesStateReducer,
} from "@langchain/langgraph";
import { openaiChat } from "../config/openai.config.js";
import { executeQuery } from "../services/db/executeQuery.service.js";
import { structureFragments } from "../services/semantic/semanticSearch.service.js";
import { listPineconeIndexes } from "../config/pinecone.config.js";

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
  for (const channelId of channelsToSearch) {
    console.log(
      `[semanticSearchNode] Performing semantic search for channel ${channelId}`
    );
    try {
      const context = await structureFragments(userQuery, channelId);
      state.searchResults[channelId] = context;
      state.messages.push(
        new AIMessage(`Context for channel ${channelId}: ${context}`)
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
    aggregatedContext += `Channel ${channelId}:\n${searchResults[channelId]}\n\n`;
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
  .addNode("aggregate", aggregationNode)
  .addNode("rephrase", rephraseAnswerNode)
  .addEdge("__start__", "getChannels")
  .addEdge("getChannels", "filterVectorizedChannels")
  .addEdge("filterVectorizedChannels", "selectChannels")
  .addEdge("selectChannels", "semanticSearch")
  .addEdge("semanticSearch", "aggregate")
  .addEdge("aggregate", "rephrase");

// -------------------------------------------------------------------------
// Guardar el estado en memoria y compilar el StateGraph
// -------------------------------------------------------------------------
const checkpointer = new MemorySaver();
const semanticAgent = semanticAgentStateGraph.compile({ checkpointer });

// -------------------------------------------------------------------------
// Función de conveniencia para invocar el Semantic Agent
// -------------------------------------------------------------------------
export async function invokeSemanticAgent(query, config = {}) {
  const initialState = { messages: [new HumanMessage(query)] };
  const finalState = await semanticAgent.invoke(initialState, {
    configurable: { thread_id: "default-thread", ...config },
  });
  const finalMessage = finalState.messages[finalState.messages.length - 1];
  return finalMessage.content;
}
