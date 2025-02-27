// src/config/openai.config.js
require("dotenv").config();
const { ChatOpenAI } = require("@langchain/openai");

const openAIConfig = {
  openAIApiKey: process.env.OPENAI_API_KEY,
};

const chatModel = new ChatOpenAI(openAIConfig);

module.exports = { chatModel, openAIConfig };
