// index.js
require("dotenv").config();
const readline = require("readline");
const {
  semanticQueryWithContext,
} = require("./services/semanticServices/semanticSearch.service");

// Crea la interfaz para leer la entrada desde la consola.
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Solicita al usuario la consulta en lenguaje natural.
rl.question("Enter your natural language query: ", (query) => {
  // Solicita el ID del canal.
  rl.question("Enter channel ID: ", async (channelId) => {
    try {
      // Ejecuta la búsqueda semántica y construye el contexto.
      const context = await semanticQueryWithContext(query, channelId);
      console.log("\nSemantic Query Context:");
      console.log(context);
    } catch (error) {
      console.error("Error during semantic query:", error);
    } finally {
      rl.close();
    }
  });
});
