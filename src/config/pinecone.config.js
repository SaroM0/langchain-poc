require("dotenv").config();
const { PineconeClient } = require("@pinecone-database/pinecone");

async function initPinecone(indexName) {
  const client = new PineconeClient();
  await client.init({
    apiKey: process.env.PINECONE_API_KEY,
  });
  return client.Index(indexName);
}

module.exports = { initPinecone };
