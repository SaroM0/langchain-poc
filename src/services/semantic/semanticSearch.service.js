// Load environment variables from the .env file
import "dotenv/config";

// Import the Pinecone configuration and dependencies
import { initPinecone } from "../../config/pinecone.config.js";
import { PineconeStore } from "@langchain/pinecone";
import { openaiEmbeddings, openaiChat } from "../../config/openai.config.js";
import { HumanMessage } from "@langchain/core/messages";

/**
 * Initializes the vector store by obtaining the Pinecone index and creating an instance
 * of PineconeStore using the pre-configured OpenAI embeddings.
 *
 * @param {string} indexName - The name of the Pinecone index to use.
 * @returns {Promise<Object>} - A promise that resolves to the vector store instance.
 */
async function initializeVectorStore(indexName) {
  // Retrieve the Pinecone index from the configuration
  const pineconeIndex = await initPinecone(indexName);

  // Create and return the vector store from the existing index
  const vectorStore = await PineconeStore.fromExistingIndex(openaiEmbeddings, {
    pineconeIndex,
    maxConcurrency: 5, // Set the maximum concurrent batch requests
  });

  return vectorStore;
}

/**
 * Executes a semantic similarity search.
 * It constructs the index name based on the channel ID, initializes the vector store,
 * and performs a similarity search using the provided natural language query.
 *
 * @param {string} query - The natural language query to search for.
 * @param {string|number} channelId - The identifier of the channel.
 * @param {number} [topK=10] - The number of top matching results to return (default is 10).
 * @param {Object} [filter={}] - Optional filter object to apply to the search.
 * @returns {Promise<Array>} - A promise that resolves to an array of search results.
 */
async function searchSimilarity(query, channelId, topK = 10, filter = {}) {
  try {
    // Construct the index name based on the channel ID (e.g., "channel-13")
    const indexName = `channel-${channelId}`;

    // Initialize the vector store for the specified index
    const vectorStore = await initializeVectorStore(indexName);

    // Execute the similarity search using the provided query, topK, and filter
    // (Ensure that the underlying PineconeStore supports passing a filter parameter)
    const results = await vectorStore.similaritySearch(query, topK, filter);
    return results;
  } catch (error) {
    console.error("Error during semantic search:", error);
    throw error;
  }
}

/**
 * Structures context fragments from the results of a semantic search.
 * It retrieves the search results and concatenates the 'message_text' from each result's metadata
 * to form a continuous context string.
 *
 * @param {string} query - The natural language query for the semantic search.
 * @param {string|number} channelId - The identifier of the channel.
 * @param {number} [topK=10] - The number of top results to consider for context (default is 10).
 * @returns {Promise<string>} - A promise that resolves to a concatenated context string.
 */
async function structureFragments(query, channelId, topK = 10) {
  try {
    // Retrieve the search results using the semantic similarity search function
    const matches = await searchSimilarity(query, channelId, topK);

    // Concatenate the 'message_text' from each match's metadata to form the context string
    let contextText = "";
    if (matches && matches.length > 0) {
      contextText = matches
        .map((match) => match.metadata.message_text)
        .join("\n");
    }
    return contextText;
  } catch (error) {
    console.error("Error during semantic query with context:", error);
    throw error;
  }
}

/**
 * Structures full results from the semantic search.
 * It retrieves the search results and returns an array of objects where each object
 * contains the vector's ID, score, and all metadata attributes (including the message text).
 *
 * @param {string} query - The natural language query for the semantic search.
 * @param {string|number} channelId - The identifier of the channel.
 * @param {number} [topK=10] - The number of top results to consider (default is 10).
 * @param {Object} [filter={}] - Optional filter object to apply to the search.
 * @returns {Promise<Array>} - A promise that resolves to an array of objects with complete vector details.
 */
async function structureFullResults(query, channelId, topK = 10, filter = {}) {
  try {
    // Retrieve the search results using the similarity search function with the filter applied
    const matches = await searchSimilarity(query, channelId, topK, filter);

    // Map each match to an object containing all attributes
    const fullResults = matches.map((match) => ({
      id: match.id,
      score: match.score,
      ...match.metadata,
    }));

    return fullResults;
  } catch (error) {
    console.error("Error during semantic query with full attributes:", error);
    throw error;
  }
}

async function extractDateRange(query) {
  const prompt = `Extract a date range from the following query, if present.
Return a JSON object with keys "startDate" and "endDate" (in ISO 8601 format) if a date range is found.
If no date range is specified, return an empty JSON object.
Query: "${query}"`;

  const response = await openaiChat.invoke([new HumanMessage(prompt)], {
    model: "o3-mini",
    max_tokens: 100,
    jsonSchema: {
      type: "object",
      properties: {
        startDate: {
          type: "string",
          description: "The start date in ISO 8601 format",
        },
        endDate: {
          type: "string",
          description: "The end date in ISO 8601 format",
        },
      },
      additionalProperties: false,
    },
  });

  let parsed;
  try {
    parsed = JSON.parse(response.content);
  } catch (error) {
    console.error("Error parsing response.content:", error);
    parsed = {};
  }
  return parsed;
}

// Export the functions for use in other parts of the application
export {
  searchSimilarity,
  structureFragments,
  structureFullResults,
  extractDateRange,
};
