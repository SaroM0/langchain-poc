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
// Option 6: Import Discord Service to sync information from Discord
const { syncDiscordData } = require("./services/discord/discord.service");
// Option 7: Import Database Initialization Service
const { initializeDatabase } = require("./services/db/initDatabase.service");
// Import sequelize y la función testConnection desde la nueva exportación
const { sequelize, testConnection } = require("./config/sequelize.config");

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
console.log("6: Obtener información de Discord");
console.log("7: Inicializar Base de Datos (Crear tablas)");

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
  const trimmed = option.trim();
  if (trimmed === "1") {
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
  } else if (trimmed === "2") {
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
  } else if (trimmed === "3") {
    startRouterConversation();
  } else if (trimmed === "4") {
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
  } else if (trimmed === "5") {
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
  } else if (trimmed === "6") {
    console.log("Obteniendo información desde Discord...");
    syncDiscordData()
      .then(() => {
        console.log(
          "Información de Discord procesada y sincronizada correctamente."
        );
      })
      .catch((error) => {
        console.error("Error sincronizando información de Discord:", error);
      })
      .finally(() => rl.close());
  } else if (trimmed === "7") {
    console.log("Inicializando la base de datos...");
    initializeDatabase()
      .then(() => {
        console.log("Base de datos inicializada correctamente");
      })
      .catch((error) => {
        console.error("Error al inicializar la base de datos:", error);
      })
      .finally(() => rl.close());
  } else {
    console.log("Invalid option");
    rl.close();
  }
});
