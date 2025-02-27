require("dotenv").config();
const { OpenAIEmbeddings } = require("@langchain/openai");

const openaiEmbeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
  model: "text-embedding-3-large",
});

module.exports = { openaiEmbeddings };
