require("dotenv").config();
const readline = require("readline");
// Importa el agente SQL stateful en lugar del antiguo databaseManagementAgent
const { invokeSQLAgent } = require("./agents/db.agent");
const {
  structureFragments,
} = require("./services/semantic/semanticSearch.service");
const { invokeRouter } = require("./agents/router.agent");

// Create an interface for reading input from the console.
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Display the menu options.
console.log("Select an option:");
console.log("1: Generate and Execute DB Agent Query (SQL Agent)");
console.log("2: Semantic Search");
console.log("3: Route Query via Router Agent");

rl.question("Option: ", (option) => {
  if (option.trim() === "1") {
    // Option 1: Use the new SQL agent (invokeSQLAgent) to generate and execute a raw SQL query.
    rl.question("Enter your natural language query: ", async (query) => {
      try {
        const result = await invokeSQLAgent(query);
        console.log("\nGenerated and Executed DB Agent Query Result:");
        console.log(result);
      } catch (error) {
        console.error("Error generating DB agent query:", error);
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
  } else if (option.trim() === "3") {
    // Option 3: Use the router agent to decide which agent to invoke.
    rl.question("Enter your natural language query: ", (query) => {
      rl.question(
        "Enter channel ID (optional, press enter to skip): ",
        async (channelId) => {
          try {
            const config = {
              channel_id:
                channelId.trim() !== "" ? channelId : "default_channel",
              thread_id: "router-thread-001",
            };
            const result = await invokeRouter(query, config);
            console.log("\nRouter Agent Query Result:");
            console.log(result);
          } catch (error) {
            console.error("Error in router agent query:", error);
          } finally {
            rl.close();
          }
        }
      );
    });
  } else {
    console.log("Invalid option");
    rl.close();
  }
});
