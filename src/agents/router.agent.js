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
// 1. Define state annotation to store messages
// --------------------------------------------------
const StateAnnotation = Annotation.Root({
  messages: Annotation({
    reducer: messagesStateReducer,
  }),
});

// --------------------------------------------------
// 2. Functions to generate refined queries dynamically
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
// 3. Utility function to decide query nature
// --------------------------------------------------
async function decideQueryNature(query) {
  const decisionPrompt = `You are a router agent. Analyze the following query and decide if it is:
- quantitative (requiring numerical, aggregated data obtained from the db tables, e.g. names, numbers, counts),
- semantic (requiring contextual, descriptive information such as emotions, attitudes, etc.), or
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
    // Hybrid flow: first call the semantic agent
    const refinedSemQuery = await getSemanticQuery(query);
    console.log(
      "[routeDecision] Hybrid - semantic part refined:",
      refinedSemQuery
    );
    semanticResult = await invokeSemanticAgent(refinedSemQuery, { channel_id });

    console.log("[routeDecision] Semantic result:", semanticResult);

    // Analyze semantic result to identify missing exact names or details
    const missingPrompt = `You are a SQL expert specialized in data validation.
Based on the semantic response below and the original user query, identify if any exact names, identifiers, or database-specific details are missing that would be necessary to provide a fully accurate quantitative answer.
Semantic response:
"${semanticResult}"
User query:
"${query}"
If something is missing, list them as a comma-separated list (e.g., table names, column names). If nothing is missing, reply with "none".`;

    const missingResponse = await openaiChat.invoke(
      [new HumanMessage(missingPrompt)],
      { model: "o3-mini", max_tokens: 500 }
    );
    const missingDetails = missingResponse.content.trim().toLowerCase();
    console.log(
      "[routeDecision] Missing details from semantic response:",
      missingDetails
    );

    let complementaryResult = "";
    // If missing details exist, generate a complementary quantitative query.
    if (missingDetails !== "none" && missingDetails !== "") {
      const complementPrompt = `You are a SQL expert. Based on the following missing details: "${missingDetails}" and the original user query: "${query}", generate a SQL query that retrieves the missing exact names and details from the database.
Return only the SQL query as plain text.`;
      const refinedComplementResponse = await openaiChat.invoke(
        [new HumanMessage(complementPrompt)],
        { model: "o3-mini", max_tokens: 500 }
      );
      const complementQuery = refinedComplementResponse.content.trim();
      console.log(
        "[routeDecision] Complementary quantitative query refined:",
        complementQuery
      );
      complementaryResult = await invokeSQLAgent(complementQuery);
    }

    // Then, perform the quantitative query as usual.
    const refinedQuantQuery = await getQuantitativeQuery(query);
    console.log(
      "[routeDecision] Hybrid - quantitative part refined:",
      refinedQuantQuery
    );
    quantitativeResult = await invokeSQLAgent(refinedQuantQuery);

    // If there is complementary information, append it to the quantitative result.
    if (complementaryResult) {
      quantitativeResult = `${quantitativeResult}\nComplementary Details:\n${complementaryResult}`;
    }
  } else {
    // Fallback default to hybrid if unknown type
    console.log("[routeDecision] Unknown query type. Defaulting to hybrid.");
    const refinedSemQuery = await getSemanticQuery(query);
    const refinedQuantQuery = await getQuantitativeQuery(query);
    semanticResult = await invokeSemanticAgent(refinedSemQuery, { channel_id });
    quantitativeResult = await invokeSQLAgent(refinedQuantQuery);
  }

  // Return results as a combined JSON object
  const combined = {
    quantitativeResult: quantitativeResult,
    semanticResult: semanticResult,
  };

  return JSON.stringify(combined);
}

// --------------------------------------------------
// 5. Create a tool definition wrapping routeDecision
// --------------------------------------------------
const routeDecisionTool = tool(routeDecision, {
  name: "routeTool",
  description:
    "Routes a user query to the DB agent (for quantitative info) and the semantic agent (for descriptive info), then dynamically complements hybrid queries by checking for missing details.",
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
