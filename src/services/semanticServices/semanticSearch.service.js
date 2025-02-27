require("dotenv").config();
const { initPinecone } = require("../../config/pinecone.config");
const { PineconeStore } = require("@langchain/pinecone");
const { OpenAIEmbeddings } = require("@langchain/openai");

async function initVectorStore(indexName) {
  // Obtain the Pinecone index using the updated configuration.
  const pineconeIndex = await initPinecone(indexName);

  // Configure the OpenAI embeddings model.
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
    model: "text-embedding-3-large",
  });

  // Create the vector store from the existing Pinecone index.
  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex,
    maxConcurrency: 5,
  });

  return vectorStore;
}

async function semanticSearch(query, channelId, topK = 10) {
  try {
    // Build the index name based on the channel ID.
    const indexName = `channel-${channelId}`;

    // Initialize the vector store for the specified index.
    const vectorStore = await initVectorStore(indexName);

    // Perform the similarity search using the natural language query.
    const results = await vectorStore.similaritySearch(query, topK);
    return results;
  } catch (error) {
    console.error("Error during semantic search:", error);
    throw error;
  }
}

async function semanticQueryWithContext(query, channelId, topK = 10) {
  try {
    // Retrieve the relevant documents via semantic search.
    const matches = await semanticSearch(query, channelId, topK);

    // Build a context string concatenating the 'message_text' from each document's metadata.
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

module.exports = {
  semanticSearch,
  semanticQueryWithContext,
};
