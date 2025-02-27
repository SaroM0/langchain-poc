require("dotenv").config();
const { Pinecone: PineconeClient } = require("@pinecone-database/pinecone");

async function initPinecone(indexName) {
  const client = new PineconeClient();
  // No es necesario llamar a client.init(), ya que el cliente usa automáticamente las variables de entorno.
  return client.Index(indexName);
}

module.exports = { initPinecone };
