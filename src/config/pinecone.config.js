require("dotenv").config();
const { Pinecone: PineconeClient } = require("@pinecone-database/pinecone");

async function initPinecone(indexName) {
  const client = new PineconeClient();
  return client.Index(indexName);
}

module.exports = { initPinecone };
