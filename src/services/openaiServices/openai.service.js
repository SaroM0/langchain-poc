// src/openaiServices/openai.service.js
require("dotenv").config();

const { chatModel } = require("../../config/openai.config");
const { OpenAIEmbeddings } = require("@langchain/openai");

/**
 * Generates a text response using the OpenAI Chat model via LangChain.
 *
 * @param {string} prompt - The prompt or input text.
 * @returns {Promise<string>} - The generated text response.
 */
async function generateText(prompt) {
  try {
    // Invoca el modelo de chat pasando el prompt.
    const response = await chatModel.invoke(prompt);
    // Se asume que la respuesta viene en el campo 'content'.
    return response.content;
  } catch (error) {
    console.error("Error generating text:", error);
    throw error;
  }
}

/**
 * Obtains the embedding vector for a given text using OpenAIEmbeddings.
 *
 * @param {string} text - The text to be embedded.
 * @returns {Promise<Array<number>>} - The embedding vector.
 */
async function getEmbedding(text) {
  try {
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });
    // Obtiene la embedding para el texto (método embedQuery o similar según la versión de la librería).
    const vector = await embeddings.embedQuery(text);
    return vector;
  } catch (error) {
    console.error("Error obtaining embedding:", error);
    throw error;
  }
}

module.exports = {
  generateText,
  getEmbedding,
};
