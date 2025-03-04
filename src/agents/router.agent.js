import { AIMessage, HumanMessage } from "@langchain/core/messages";
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
import { invokeSemanticAgent } from "./semantic.agent.js";
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
// 2. Functions to generate specialized queries dynamically
// --------------------------------------------------
async function getQuantitativeQuery(query) {
  const prompt = `You are a SQL expert specialized in quantitative analysis. 
Given the following user query:
"${query}"
Generate a refined quantitative query that instructs the DB agent to return channel names and user names representing the most active and positive participants.
Return only the refined query as plain text.`;

  const response = await openaiChat.invoke([new HumanMessage(prompt)], {
    model: "o3-mini",
    max_tokens: 500,
  });
  return response.content.trim();
}

async function getSemanticQuery(query) {
  const prompt = `You are an expert in semantic analysis. 
Given the following user query:
"${query}"
Generate a refined semantic query that instructs the Semantic agent to return descriptive insights regarding positive and energetic messages in a natural, conversational tone.
Return only the refined query as plain text.`;

  const response = await openaiChat.invoke([new HumanMessage(prompt)], {
    model: "o3-mini",
    max_tokens: 500,
  });
  return response.content.trim();
}

// --------------------------------------------------
// 3. Utility function that decides the query nature
// --------------------------------------------------
async function decideQueryNature(query) {
  const decisionPrompt = `You are a router agent. Analyze the following query and decide if it is:
- quantitative (requiring numerical, aggregated data that can be obtained from the db tables eg. names, numbers, counts, times),
- semantic (requiring contextual, descriptive information such as emotions, attitudes, and similar aspects), or
- hybrid (requiring a combination of both types of information).

Query: "${query}"

Return your answer strictly as a JSON object with a key "choice" whose value is one of "quantitative", "semantic", or "hybrid".`;

  const decisionResponse = await openaiChat.call([
    new HumanMessage(decisionPrompt),
  ]);

  try {
    const parsed = JSON.parse(decisionResponse.content);
    console.log("[decideQueryNature] Parsed decision:", parsed);
    return parsed;
  } catch (err) {
    console.warn("[decideQueryNature] Parsing failed. Defaulting to hybrid.");
    return { choice: "hybrid" };
  }
}

// --------------------------------------------------
// 4. Routing logic that directs the query to the appropriate backend(s)
// --------------------------------------------------
async function routeDecision({ query, channel_id }) {
  console.log("[routeDecision] Routing started.");
  console.log("[routeDecision] Query:", query, "Channel ID:", channel_id);

  const decision = await decideQueryNature(query);
  console.log("[routeDecision] Query type determined:", decision.choice);

  let quantitativeResult = "";
  let semanticResult = "";

  if (decision.choice === "quantitative") {
    const refinedQuantQuery = await getQuantitativeQuery(query);
    console.log(
      "[routeDecision] Quantitative query refined:",
      refinedQuantQuery
    );
    quantitativeResult = await invokeSQLAgent(refinedQuantQuery);
  } else if (decision.choice === "semantic") {
    const refinedSemQuery = await getSemanticQuery(query);
    console.log("[routeDecision] Semantic query refined:", refinedSemQuery);
    semanticResult = await invokeSemanticAgent(refinedSemQuery, { channel_id });
  } else if (decision.choice === "hybrid") {
    const refinedQuantQuery = await getQuantitativeQuery(query);
    const refinedSemQuery = await getSemanticQuery(query);
    console.log(
      "[routeDecision] Hybrid queries refined:",
      refinedQuantQuery,
      refinedSemQuery
    );
    quantitativeResult = await invokeSQLAgent(refinedQuantQuery);
    semanticResult = await invokeSemanticAgent(refinedSemQuery, { channel_id });
  } else {
    const refinedQuantQuery = await getQuantitativeQuery(query);
    const refinedSemQuery = await getSemanticQuery(query);
    console.log(
      "[routeDecision] Unknown query type. Defaulting to hybrid queries."
    );
    quantitativeResult = await invokeSQLAgent(refinedQuantQuery);
    semanticResult = await invokeSemanticAgent(refinedSemQuery, { channel_id });
  }

  // Combine the results into a consolidated response (using names, not IDs)
  const combined = `Quantitative Data:
${quantitativeResult}

Semantic Insights:
${semanticResult}

Final Analysis: The above information, combining both numerical data and contextual insights, identifies the key channels and users with positive and participative activity.`;

  return JSON.stringify({ combinedResult: combined });
}

// --------------------------------------------------
// 5. Create a tool definition wrapping routeDecision
// --------------------------------------------------
const routeDecisionTool = tool(routeDecision, {
  name: "routeTool",
  description:
    "Routes a user query to the DB agent (for quantitative info) and the semantic agent (for descriptive info) and combines the results.",
  schema: z.object({
    query: z.string().describe("The user's query."),
    channel_id: z
      .string()
      .optional()
      .describe("Channel ID for semantic search context."),
  }),
});

// --------------------------------------------------
// 6. Gather all tools in an array and wrap them in a ToolNode
// --------------------------------------------------
const tools = [routeDecisionTool];
const toolNode = new ToolNode(tools);

// --------------------------------------------------
// 7. Bind openaiChat LLM to the tools so it can call them
// --------------------------------------------------
const model = openaiChat.bindTools(tools);

// --------------------------------------------------
// 8. Node that calls the model with the current conversation messages
// --------------------------------------------------
async function callModel(state) {
  const response = await model.invoke(state.messages);
  return { messages: [response] };
}

// --------------------------------------------------
// 9. Check if further tool calls are needed or end the conversation
// --------------------------------------------------
function shouldContinue(state) {
  console.log("[shouldContinue] Checking if further tool calls are needed.");
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];

  const isAI = lastMessage?._getType?.() === "ai";
  const calls = lastMessage?.additional_kwargs?.tool_calls;

  if (isAI && Array.isArray(calls) && calls.length > 0) {
    return "tools";
  }
  return "__end__";
}

// --------------------------------------------------
// 10. Build the StateGraph: agent (LLM) -> tools -> agent, etc.
// --------------------------------------------------
const workflow = new StateGraph(StateAnnotation)
  .addNode("agent", callModel)
  .addNode("tools", toolNode)
  .addEdge("__start__", "agent")
  .addConditionalEdges("agent", shouldContinue)
  .addEdge("tools", "agent");

// --------------------------------------------------
// 11. Memory saver to persist state across runs
// --------------------------------------------------
const checkpointer = new MemorySaver();

// --------------------------------------------------
// 12. Compile the graph to a Runnable
// --------------------------------------------------
const app = workflow.compile({ checkpointer });

// --------------------------------------------------
// 13. Convenience function to invoke the router
// --------------------------------------------------
export async function invokeRouter(query, config = {}) {
  const messages = [new HumanMessage(query)];
  const finalState = await app.invoke({ messages }, { configurable: config });
  const finalMessage = finalState.messages[finalState.messages.length - 1];
  return finalMessage.content;
}
