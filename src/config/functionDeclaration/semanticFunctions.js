const semanticQueryWithContext = {
  type: "function",
  name: "semanticQueryWithContext",
  description: "Performs a semantic search on the vectorized database.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query for the semantic vector search.",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
};

module.exports = semanticQueryWithContext;
