require("dotenv").config();
const { OpenAIEmbeddings, ChatOpenAI } = require("@langchain/openai");

const openaiEmbeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
  model: "text-embedding-3-large",
});

const openaiChat = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  modelName: "o3-mini",
});

module.exports = { openaiEmbeddings, openaiChat };
