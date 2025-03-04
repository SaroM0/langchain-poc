require("dotenv").config();
const readline = require("readline");
// Importa el SQL agent (opción 1)
const { invokeSQLAgent } = require("./agents/db.agent");
// Importa el Semantic Agent (opción 2)
const { invokeSemanticAgent } = require("./agents/semantic.agent");
const { invokeRouter } = require("./agents/router.agent");

// Create an interface for reading input from the console.
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Display the menu options.
console.log("Select an option:");
console.log("1: Generate and Execute DB Agent Query (SQL Agent)");
console.log("2: Semantic Search (Semantic Agent)");
console.log("3: Route Query via Router Agent");

rl.question("Option: ", (option) => {
  if (option.trim() === "1") {
    // Option 1: Use the SQL Agent to generate and execute a raw SQL query.
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
    // Option 2: Use the Semantic Agent to obtain semantic context.
    rl.question("Enter your natural language query: ", async (query) => {
      try {
        const result = await invokeSemanticAgent(query);
        console.log("\nSemantic Agent Query Result:");
        console.log(result);
      } catch (error) {
        console.error("Error in semantic agent query:", error);
      } finally {
        rl.close();
      }
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
