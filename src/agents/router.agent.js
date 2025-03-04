import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { StateGraph } from "@langchain/langgraph";
import {
  MemorySaver,
  Annotation,
  messagesStateReducer,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";

import { invokeSQLAgent } from "./db.agent.js";
import { invokeSemanticAgent } from "./semanticAgent.js"; // Importamos el Semantic Agent
import { openaiChat } from "../config/openai.config.js";

// --------------------------------------------------
// 1. Define the state annotation to store messages
// --------------------------------------------------
const StateAnnotation = Annotation.Root({
  messages: Annotation({
    reducer: messagesStateReducer,
  }),
});

// --------------------------------------------------
// 2. Utility function that decides the query nature
// --------------------------------------------------
async function decideQueryNature(query) {
  console.log("[decideQueryNature] Received query:", query);

  // Se amplía el prompt para incluir la opción "hybrid" en caso de que se requiera combinar ambas búsquedas.
  const decisionPrompt = `You are a router agent. Analyze the following query and decide if it is:
- quantitative (requiring numerical, aggregated data),
- semantic (requiring contextual, descriptive information), or
- hybrid (requiring both types of information).

Query: "${query}"

Return your answer strictly as a JSON object with a key "choice" whose value is one of "quantitative", "semantic", or "hybrid".`;

  console.log("[decideQueryNature] Calling openaiChat with prompt:");
  console.log(decisionPrompt);

  const decisionResponse = await openaiChat.call([
    new HumanMessage(decisionPrompt),
  ]);

  console.log("[decideQueryNature] Model response content:");
  console.log(decisionResponse.content);

  try {
    const parsed = JSON.parse(decisionResponse.content);
    console.log("[decideQueryNature] Parsed decision:", parsed);
    return parsed;
  } catch (err) {
    console.warn(
      "[decideQueryNature] JSON parse failed, defaulting to hybrid."
    );
    return { choice: "hybrid" };
  }
}

// --------------------------------------------------
// 3. Routing logic (a tool) that calls the correct backend(s)
// --------------------------------------------------
async function routeDecision({ query, channel_id }) {
  console.log("[routeDecision] Started routing logic.");
  console.log("[routeDecision] query:", query, "channel_id:", channel_id);

  const decision = await decideQueryNature(query);
  console.log("[routeDecision] Router Decision:", decision);

  let quantitativeResult = "";
  let semanticResult = "";

  // Según el tipo de consulta, se delega a uno o a ambos agentes.
  if (decision.choice === "quantitative") {
    console.log("[routeDecision] Sending query to invokeSQLAgent...");
    quantitativeResult = await invokeSQLAgent(query);
  } else if (decision.choice === "semantic") {
    console.log("[routeDecision] Sending query to invokeSemanticAgent...");
    semanticResult = await invokeSemanticAgent(query, { channel_id });
  } else if (decision.choice === "hybrid") {
    console.log(
      "[routeDecision] Hybrid query detected. Invoking both agents..."
    );
    quantitativeResult = await invokeSQLAgent(query);
    semanticResult = await invokeSemanticAgent(query, { channel_id });
  } else {
    console.log("[routeDecision] Unknown query type. Defaulting to hybrid.");
    quantitativeResult = await invokeSQLAgent(query);
    semanticResult = await invokeSemanticAgent(query, { channel_id });
  }

  // Combina ambos resultados en una respuesta final natural.
  const combined = `Quantitative Result:\n${quantitativeResult}\n\nSemantic Result:\n${semanticResult}\n\nCombined Analysis: Based on both the aggregated data and the contextual insights, these are the final findings.`;

  console.log("[routeDecision] Combined Result:", combined);
  return JSON.stringify({ combinedResult: combined });
}

// --------------------------------------------------
// 4. Create a tool definition wrapping `routeDecision`
// --------------------------------------------------
const routeDecisionTool = tool(routeDecision, {
  name: "routeTool",
  description:
    "Routes a user query to the DB agent (for quantitative info) and/or the semantic agent (for descriptive info) and combines the results.",
  schema: z.object({
    query: z.string().describe("The user's query."),
    channel_id: z
      .string()
      .optional()
      .describe("Channel ID for semantic search context."),
  }),
});

// --------------------------------------------------
// 5. Gather all tools in an array and wrap in a ToolNode
// --------------------------------------------------
const tools = [routeDecisionTool];
const toolNode = new ToolNode(tools);

// --------------------------------------------------
// 6. Bind your openaiChat LLM to the tools, so it can call them
// --------------------------------------------------
const model = openaiChat.bindTools(tools);

// --------------------------------------------------
// 7. Node that calls the model with current conversation
// --------------------------------------------------
async function callModel(state) {
  console.log("[callModel] Invoked with state.messages:", state.messages);
  const response = await model.invoke(state.messages);
  console.log("[callModel] Model response:", response);
  return { messages: [response] };
}

// --------------------------------------------------
// 8. Decide whether to continue to "tools" or end
// --------------------------------------------------
function shouldContinue(state) {
  console.log("[shouldContinue] Checking if we need to call tools...");
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];
  console.log("[shouldContinue] lastMessage:", lastMessage);

  const isAI = lastMessage?._getType?.() === "ai";
  const calls = lastMessage?.additional_kwargs?.tool_calls;

  if (isAI && Array.isArray(calls) && calls.length > 0) {
    console.log("[shouldContinue] Detected tool_calls:", calls);
    return "tools";
  }
  console.log("[shouldContinue] No tool calls. Ending conversation.");
  return "__end__";
}

// --------------------------------------------------
// 9. Build the StateGraph: agent (LLM) -> tools -> agent, etc.
// --------------------------------------------------
const workflow = new StateGraph(StateAnnotation)
  .addNode("agent", callModel)
  .addNode("tools", toolNode)
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tools", "agent");

// --------------------------------------------------
// 10. Memory saver to persist state across runs
// --------------------------------------------------
const checkpointer = new MemorySaver();

// --------------------------------------------------
// 11. Compile the graph to a Runnable
// --------------------------------------------------
const app = workflow.compile({ checkpointer });

// --------------------------------------------------
// 12. Provide a convenience function to invoke the router
// --------------------------------------------------
export async function invokeRouter(query, config = {}) {
  console.log("[invokeRouter] Received query:", query);
  console.log("[invokeRouter] Received config:", config);

  const messages = [new HumanMessage(query)];

  console.log("[invokeRouter] Invoking state graph with initial messages...");
  const finalState = await app.invoke({ messages }, { configurable: config });

  console.log("[invokeRouter] Final state messages:", finalState.messages);
  const finalMessage = finalState.messages[finalState.messages.length - 1];
  console.log("[invokeRouter] Final message content:", finalMessage.content);

  return finalMessage.content;
}
