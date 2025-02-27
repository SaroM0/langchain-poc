// src/services/semanticSearch.service.js
require("dotenv").config();
const { initPinecone } = require("../../config/pinecone.config");
const { PineconeStore } = require("langchain/vectorstores/pinecone");
const { OpenAIEmbeddings } = require("@langchain/openai");

/**
 * Inicializa el vector store de Pinecone usando LangChain.
 *
 * @param {string} indexName - El nombre del índice a utilizar.
 * @returns {Promise<PineconeStore>} - Una instancia del vector store lista para búsquedas semánticas.
 */
async function initVectorStore(indexName) {
  // Obtiene el índice de Pinecone utilizando la configuración actualizada (incluyendo environment).
  const index = await initPinecone(indexName);
  // Configura el modelo de embeddings de OpenAI.
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
  });
  // Crea el vector store a partir del índice existente de Pinecone.
  const vectorStore = await PineconeStore.fromExistingIndex(index, embeddings);
  return vectorStore;
}

/**
 * Realiza una búsqueda semántica en los mensajes vectorizados de un canal específico usando LangChain.
 *
 * @param {string} query - La consulta en lenguaje natural.
 * @param {string|number} channelId - El ID del canal en el que se realizará la búsqueda.
 * @param {number} topK - Número de resultados principales a devolver (por defecto es 10).
 * @returns {Promise<Array>} - Un arreglo con los documentos (mensajes) coincidentes junto a sus metadatos.
 */
async function semanticSearch(query, channelId, topK = 10) {
  try {
    // Construir el nombre del índice en base al ID del canal.
    const indexName = `channel-${channelId}`;
    // Inicializar el vector store para el índice especificado.
    const vectorStore = await initVectorStore(indexName);
    // Ejecutar la búsqueda de similitud usando el query en lenguaje natural.
    const results = await vectorStore.similaritySearch(query, topK);
    return results;
  } catch (error) {
    console.error("Error during semantic search:", error);
    throw error;
  }
}

/**
 * Usa el contexto obtenido de los resultados de la búsqueda semántica para construir un string de contexto.
 *
 * @param {string} query - La consulta en lenguaje natural.
 * @param {string|number} channelId - El ID del canal en el que se realizará la búsqueda.
 * @param {number} topK - Número de resultados a utilizar como contexto (por defecto es 10).
 * @returns {Promise<string>} - El contexto construido a partir de los documentos recuperados.
 */
async function semanticQueryWithContext(query, channelId, topK = 10) {
  try {
    // Obtener los documentos relevantes mediante la búsqueda semántica.
    const matches = await semanticSearch(query, channelId, topK);
    // Construir un string de contexto concatenando el campo "message_text" de los metadatos.
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
