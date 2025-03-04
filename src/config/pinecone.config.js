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
  const client = new PineconeClient();
  return client.Index(indexName);
}

/**
 * Lists all indexes available in the current Pinecone environment.
 *
 * This function creates a new instance of the Pinecone client and retrieves a list of all index names.
 *
 * @returns {Promise<Array<string>>} An array with the names of the indexes.
 */
async function listPineconeIndexes() {
  const client = new PineconeClient();
  try {
    const indexesObj = await client.listIndexes();
    console.log("Pinecone indexes:", indexesObj);
    if (indexesObj && Array.isArray(indexesObj.indexes)) {
      return indexesObj.indexes.map((index) => index.name);
    } else {
      return [];
    }
  } catch (error) {
    console.error("Error listing Pinecone indexes:", error);
    return [];
  }
}

module.exports = { initPinecone, listPineconeIndexes };
