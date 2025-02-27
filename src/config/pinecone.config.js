require("dotenv").config();

// Import the Pinecone client from the official Pinecone SDK and alias it as PineconeClient
const { Pinecone: PineconeClient } = require("@pinecone-database/pinecone");

/**
 * Initializes a Pinecone index using the provided index name.
 *
 * This function creates a new instance of the Pinecone client and returns the index instance
 * corresponding to the specified index name. The client automatically reads environment variables
 * (e.g., PINECONE_API_KEY, PINECONE_ENVIRONMENT) if they are set in the .env file.
 *
 * @param {string} indexName - The name of the Pinecone index to be initialized.
 * @returns {Object} The initialized Pinecone index instance.
 */
async function initPinecone(indexName) {
  // Create a new instance of the Pinecone client
  const client = new PineconeClient();

  // Return the index instance using the provided index name
  return client.Index(indexName);
}

// Export the initPinecone function for use in other modules
module.exports = { initPinecone };
