require("dotenv").config();
const { initPinecone } = require("../../config/pinecone.config");
const { PineconeStore } = require("@langchain/pinecone");
const { openaiEmbeddings } = require("../../config/openai.config");

async function initVectorStore(indexName) {
  const pineconeIndex = await initPinecone(indexName);

  const vectorStore = await PineconeStore.fromExistingIndex(openaiEmbeddings, {
    pineconeIndex,
    maxConcurrency: 5,
  });

  return vectorStore;
}

async function semanticSearch(query, channelId, topK = 10) {
  try {
    const indexName = `channel-${channelId}`;

    const vectorStore = await initVectorStore(indexName);

    const results = await vectorStore.similaritySearch(query, topK);
    return results;
  } catch (error) {
    console.error("Error during semantic search:", error);
    throw error;
  }
}

async function semanticQueryWithContext(query, channelId, topK = 10) {
  try {
    const matches = await semanticSearch(query, channelId, topK);

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
