const { z } = require("zod");
const { DynamicStructuredTool } = require("@langchain/core/tools");
const {
  generateSQLQuery,
} = require("../../services/databaseService/relationalQueryAgent.service");

const generateSQLQueryFunction = new DynamicStructuredTool({
  name: "generateSQLQuery",
  description:
    "Generates a SQL query from a natural language prompt, sanitizes and validates it, executes it using Sequelize, and returns the query result.",
  schema: z.object({
    userPrompt: z
      .string()
      .describe("A natural language description of the desired SQL query."),
  }),
  func: async ({ userPrompt }) => {
    console.log(
      "Function Calling: Executing generateSQLQuery with:",
      userPrompt
    );
    const result = await generateSQLQuery(userPrompt);
    return result;
  },
});

module.exports = {
  generateSQLQueryFunction,
};
