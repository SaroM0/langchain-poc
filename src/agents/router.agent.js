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

// -- Import your existing modules in ESM style
import { databaseManagementAgent } from "./db.agent.js";
import { structureFragments } from "../services/semantic/semanticSearch.service.js";
import { openaiChat } from "../config/openai.config.js"; // <--- Use your custom openai chat instance

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
  const decisionPrompt = `You are a router agent. Analyze the following query and decide if it is quantitative (requiring numerical, aggregated data) or semantic (requiring contextual, descriptive information).

Query: "${query}"

Return your answer strictly as a JSON object:
{"choice": "quantitative"}
or
{"choice": "semantic"}`;

  // Use your openaiChat to call the model for decision
  const decisionResponse = await openaiChat.call([
    new HumanMessage(decisionPrompt),
  ]);
  try {
    return JSON.parse(decisionResponse.content);
  } catch {
    // If parsing fails, default to "semantic"
    return { choice: "semantic" };
  }
}

// --------------------------------------------------
// 3. Routing logic (a tool) that calls the correct backend
// --------------------------------------------------
async function routeDecision({ query, channel_id }) {
  const decision = await decideQueryNature(query);
  console.log("Router Decision:", decision);

  let result;
  if (decision.choice === "quantitative") {
    // Quantitative => DB agent
    result = await databaseManagementAgent(query);
  } else {
    // Semantic => structureFragments
    const safeChannelId = channel_id || "default_channel";
    result = await structureFragments(query, safeChannelId);
  }
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
  const { messages } = state;
  const response = await model.invoke(messages);
  return { messages: [response] };
}

// --------------------------------------------------
// 8. Decide whether to continue to "tools" or end
// --------------------------------------------------
function shouldContinue(state) {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];
  if (lastMessage instanceof AIMessage && lastMessage.tool_calls?.length) {
    return "tools";
  }
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
  // Create a new message from the user
  const messages = [new HumanMessage(query)];

  // Optionally pass channel_id, thread_id, etc. via `configurable`
  const finalState = await app.invoke({ messages }, { configurable: config });

  // Return the content of the final message
  return finalState.messages[finalState.messages.length - 1].content;
}
