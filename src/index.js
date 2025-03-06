require("dotenv").config();
const readline = require("readline");

// Option 1: Import SQL agent
const { invokeSQLAgent } = require("./agents/db.agent");
// Option 2: Import Semantic Agent
const { invokeSemanticAgent } = require("./agents/semantic.agent");
// Option 3: Import Router Agent
const { invokeRouter } = require("./agents/router.agent");
// Option 4 & 5: Import channel vectorization functions and Channel model
const {
  createIndicesForNewChannels,
  processChannelMessages,
} = require("./services/vectorize/channelVectorization");
const { Channel } = require("./models/db");

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
console.log("4: Index Channels");
console.log("5: Vectorize Channel Messages");

// Function to keep the Router Agent conversation active.
function startRouterConversation() {
  rl.question(
    "Enter your natural language query (or type 'exit' to quit): ",
    async (query) => {
      if (query.trim().toLowerCase() === "exit") {
        console.log("Ending conversation.");
        return rl.close();
      }
      try {
        const config = {
          channel_id: "default_channel",
          thread_id: "router-thread-001",
        };
        const result = await invokeRouter(query, config);
        console.log("\nRouter Agent Query Result:");
        console.log(result);
      } catch (error) {
        console.error("Error in router agent query:", error);
      }
      startRouterConversation();
    }
  );
}

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
    // Option 3: Start a persistent conversation with the Router Agent.
    startRouterConversation();
  } else if (option.trim() === "4") {
    // Option 4: Index Channels.
    rl.question(
      "Do you want to provide a list of channel IDs? (yes/no): ",
      async (answer) => {
        if (answer.trim().toLowerCase() === "yes") {
          rl.question(
            "Enter channel IDs separated by commas: ",
            async (ids) => {
              const channelIds = ids.split(",").map((id) => id.trim());
              try {
                const channels = await Channel.findAll({
                  where: { id: channelIds },
                });
                if (!channels || channels.length === 0) {
                  console.log("No channels found with the provided IDs.");
                  return rl.close();
                }
                await createIndicesForNewChannels(channels);
                console.log("Finished indexing provided channels.");
              } catch (error) {
                console.error("Error indexing provided channels:", error);
              }
              rl.close();
            }
          );
        } else {
          // No list provided, index all new channels.
          try {
            await createIndicesForNewChannels();
            console.log("Finished indexing all new channels.");
          } catch (error) {
            console.error("Error indexing channels:", error);
          }
          rl.close();
        }
      }
    );
  } else if (option.trim() === "5") {
    // Option 5: Vectorize Channel Messages.
    rl.question(
      "Enter the channel ID to vectorize its messages: ",
      async (channelId) => {
        try {
          const channel = await Channel.findOne({ where: { id: channelId } });
          if (!channel) {
            console.log("Channel not found.");
          } else {
            console.log(
              `Vectorizing messages for channel "${channel.name}"...`
            );
            await processChannelMessages(channel);
            console.log(
              `Finished vectorizing messages for channel "${channel.name}".`
            );
          }
        } catch (error) {
          console.error("Error vectorizing channel messages:", error);
        } finally {
          rl.close();
        }
      }
    );
  } else {
    console.log("Invalid option");
    rl.close();
  }
});
