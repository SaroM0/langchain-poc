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

import { databaseManagementAgent } from "./db.agent.js";
import { structureFragments } from "../services/semantic/semanticSearch.service.js";
import { openaiChat } from "../config/openai.config.js"; // Your custom openai chat instance

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

  const decisionPrompt = `You are a router agent. Analyze the following query and decide if it is quantitative (requiring numerical, aggregated data) or semantic (requiring contextual, descriptive information).

Query: "${query}"

Return your answer strictly as a JSON object:
{"choice": "quantitative"}
or
{"choice": "semantic"}`;

  // Use your openaiChat to call the model for decision
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
      "[decideQueryNature] JSON parse failed, defaulting to semantic."
    );
    return { choice: "semantic" };
  }
}

// --------------------------------------------------
// 3. Routing logic (a tool) that calls the correct backend
// --------------------------------------------------
async function routeDecision({ query, channel_id }) {
  console.log("[routeDecision] Started routing logic.");
  console.log("[routeDecision] query:", query, "channel_id:", channel_id);

  const decision = await decideQueryNature(query);
  console.log("[routeDecision] Router Decision:", decision);

  let result;
  if (decision.choice === "quantitative") {
    // Quantitative => DB agent
    console.log("[routeDecision] Sending query to databaseManagementAgent...");
    result = await databaseManagementAgent(query);
  } else {
    // Semantic => structureFragments
    console.log("[routeDecision] Sending query to structureFragments...");
    const safeChannelId = channel_id || "default_channel";
    result = await structureFragments(query, safeChannelId);
  }

  console.log("[routeDecision] Result from chosen logic:", result);
  return JSON.stringify(result);
}

// --------------------------------------------------
// 4. Create a tool definition wrapping `routeDecision`
// --------------------------------------------------
const routeDecisionTool = tool(routeDecision, {
  name: "routeTool",
  description:
    "Routes user query to the DB agent (if quantitative) or the semantic logic (if descriptive).",
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

  // Log the shape so you can see what's happening.
  console.log("[shouldContinue] lastMessage:", lastMessage);

  // Option 1: Check for typical AI message shape
  const isAI = lastMessage?._getType?.() === "ai";

  // Get any tool calls from additional_kwargs
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

  // Create a new message from the user
  const messages = [new HumanMessage(query)];

  // Optionally pass channel_id, thread_id, etc. via `configurable`
  console.log("[invokeRouter] Invoking state graph with initial messages...");
  const finalState = await app.invoke({ messages }, { configurable: config });

  console.log("[invokeRouter] Final state messages:", finalState.messages);
  const finalMessage = finalState.messages[finalState.messages.length - 1];
  console.log("[invokeRouter] Final message content:", finalMessage.content);

  // Return the content of the final message
  return finalMessage.content;
}
