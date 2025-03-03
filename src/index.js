require("dotenv").config();
const readline = require("readline");
const {
  generateSQLQuery,
} = require("./services/databaseService/relationalQueryAgent.service");
const {
  structureFragments,
} = require("./services/semanticServices/semanticSearch.service");

// Create an interface for reading input from the console.
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Display the menu options.
console.log("Select an option:");
console.log("1: Generate Sequelize Query");
console.log("2: Semantic Search");

rl.question("Option: ", (option) => {
  if (option.trim() === "1") {
    // Option 1: Generate a Sequelize query from a natural language prompt.
    rl.question("Enter your natural language query: ", async (query) => {
      try {
        const result = await generateSQLQuery(query);
        console.log("\nGenerated Sequelize Query Result:");
        console.log(result);
      } catch (error) {
        console.error("Error generating Sequelize query:", error);
      } finally {
        rl.close();
      }
    });
  } else if (option.trim() === "2") {
    // Option 2: Perform a semantic search.
    rl.question("Enter your natural language query: ", (query) => {
      rl.question("Enter channel ID: ", async (channelId) => {
        try {
          const context = await structureFragments(query, channelId);
          console.log("\nSemantic Query Context:");
          console.log(context);
        } catch (error) {
          console.error("Error during semantic query:", error);
        } finally {
          rl.close();
        }
      });
    });
  } else {
    console.log("Invalid option");
    rl.close();
  }
});
