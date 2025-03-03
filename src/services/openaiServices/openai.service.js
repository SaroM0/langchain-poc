require("dotenv").config();

const { openaiEmbeddings, openaiChat } = require("../../config/openai.config");

/**
 * Generates a text response using the OpenAI Chat model via LangChain.
 *
 * @param {string} prompt - The prompt or input text.
 * @returns {Promise<string>} - The generated text response.
 */
async function generateText(prompt) {
  try {
    // Replace "chatModel" with "openaiChat"
    const response = await openaiChat.invoke(prompt);
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
    // Se podría reutilizar la instancia importada: openaiEmbeddings
    const vector = await openaiEmbeddings.embedQuery(text);
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
