const generateSQLQueryFunction = {
  type: "function",
  name: "generateSQLQuery",
  description:
    "Generates a SQL query from a natural language prompt, sanitizes and validates it, executes it using Sequelize (optionally within a transaction), and returns the query result.",
  parameters: {
    type: "object",
    properties: {
      userPrompt: {
        type: "string",
        description:
          "A natural language description of the desired SQL query to be executed on the relational database.",
      },
    },
    required: ["userPrompt"],
    additionalProperties: false,
  },
};

module.exports = {
  generateSQLQueryFunction,
};
