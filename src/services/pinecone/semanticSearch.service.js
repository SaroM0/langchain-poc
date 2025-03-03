// Load environment variables from the .env file
require("dotenv").config();

// Import the Pinecone configuration and dependencies
const { initPinecone } = require("../../config/pinecone.config");
const { PineconeStore } = require("@langchain/pinecone");
const { openaiEmbeddings } = require("../../config/openai.config");

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
 * @returns {Promise<Array>} - A promise that resolves to an array of search results.
 */
async function searchSimilarity(query, channelId, topK = 10) {
  try {
    // Construct the index name based on the channel ID (e.g., "channel-13")
    const indexName = `channel-${channelId}`;

    // Initialize the vector store for the specified index
    const vectorStore = await initializeVectorStore(indexName);

    // Execute the similarity search using the provided query and return the results
    const results = await vectorStore.similaritySearch(query, topK);
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

// Export the functions for use in other parts of the application
module.exports = {
  searchSimilarity,
  structureFragments,
};
