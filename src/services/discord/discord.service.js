const client = require("../../config/discordClient");
const { ensureOrganization } = require("./discordToDb/organization.service");
const { upsertUser } = require("./discordToDb/user.service");
const { saveServer } = require("./discordToDb/server.service");
const { saveChannel } = require("./discordToDb/channel.service");
const { saveThread } = require("./discordToDb/thread.service");
const { saveMessage } = require("./discordToDb/message.service");
const { saveRole } = require("./discordToDb/role.service");

client.once("ready", async () => {
  try {
    const organizationId = await ensureOrganization();

    // Iterate through each guild (server)
    for (const [guildId, server] of client.guilds.cache) {
      const serverInternalId = await saveServer(server, organizationId);
      await server.members.fetch({ time: 3600000 });

      // Upsert each member.
      for (const [memberId, member] of server.members.cache) {
        try {
          await upsertUser(
            member.id,
            serverInternalId,
            member.user.username,
            member.nickname || member.user.username
          );
        } catch (error) {
          console.error(`Error saving member ${member.id}:`, error);
        }
      }

      // Process roles (excluding @everyone).
      server.roles.cache.forEach(async (role) => {
        if (role.id === server.id) return;
        try {
          await saveRole(role);
        } catch (error) {
          console.error(`Error saving role ${role.id}:`, error);
        }
      });

      // Process text channels that are not threads.
      const nonThreadChannels = server.channels.cache.filter(
        (ch) => ch.isTextBased() && !ch.isThread()
      );
      const parentChannelMap = {};

      for (const [channelId, channel] of nonThreadChannels) {
        let channelInternalId;
        try {
          channelInternalId = await saveChannel(serverInternalId, channel);
          parentChannelMap[channel.id] = channelInternalId;
        } catch (error) {
          if (error.code === 50001) {
            console.warn(
              `Missing Access for channel ${channelId}. Skipping channel and its messages.`
            );
          } else {
            console.error(`Error saving channel ${channelId}:`, error);
          }
          continue;
        }

        // Fetch and save messages in the channel.
        let fetchedMessages = [];
        let lastMessageId = null;
        while (true) {
          const options = { limit: 100 };
          if (lastMessageId) options.before = lastMessageId;
          let batch;
          try {
            batch = await channel.messages.fetch(options);
          } catch (error) {
            if (error.code === 50001) {
              console.warn(
                `Missing Access for channel ${channelId} while fetching messages. Skipping messages.`
              );
            } else {
              console.error(
                `Error fetching messages for channel ${channelId}:`,
                error
              );
            }
            break;
          }
          if (batch.size === 0) break;
          fetchedMessages.push(...batch.values());
          lastMessageId = batch.last().id;
        }
        if (fetchedMessages.length > 0) {
          await Promise.all(
            fetchedMessages.map((msg) =>
              saveMessage(serverInternalId, channelInternalId, msg)
            )
          );
        }
      }

      // Process threads in each text channel.
      for (const [channelId, channel] of nonThreadChannels) {
        const threads = new Map();
        try {
          const activeThreads = await channel.threads.fetchActive({
            time: 3600000,
          });
          activeThreads.threads.forEach((thread) =>
            threads.set(thread.id, thread)
          );
        } catch (error) {
          console.error(
            `Error fetching active threads for channel ${channelId}:`,
            error
          );
        }
        try {
          const archivedThreads = await channel.threads.fetchArchived({
            time: 3600000,
          });
          archivedThreads.threads.forEach((thread) =>
            threads.set(thread.id, thread)
          );
        } catch (error) {
          console.error(
            `Error fetching archived threads for channel ${channelId}:`,
            error
          );
        }
        for (const [threadId, thread] of threads) {
          if (![10, 11, 12].includes(thread.type)) {
            console.warn(
              `Thread ${thread.id} is not a valid thread type. Skipping.`
            );
            continue;
          }
          const parentChannelInternalId = parentChannelMap[thread.parentId];
          if (!parentChannelInternalId) {
            console.warn(
              `Parent channel for thread ${thread.id} not found. Skipping thread.`
            );
            continue;
          }
          const threadInternalId = await saveThread(
            parentChannelInternalId,
            thread
          );
          let fetchedMessages = [];
          let lastMessageId = null;
          while (true) {
            const options = { limit: 100, time: 3600000 };
            if (lastMessageId) options.before = lastMessageId;
            let batch;
            try {
              batch = await thread.messages.fetch(options);
            } catch (error) {
              if (error.code === 50001) {
                console.warn(
                  `Missing Access for thread ${thread.id} while fetching messages. Skipping messages.`
                );
              } else {
                console.error(
                  `Error fetching messages for thread ${thread.id}:`,
                  error
                );
              }
              break;
            }
            if (batch.size === 0) break;
            fetchedMessages.push(...batch.values());
            lastMessageId = batch.last().id;
          }
          if (fetchedMessages.length > 0) {
            await Promise.all(
              fetchedMessages.map((msg) =>
                saveMessage(
                  serverInternalId,
                  parentChannelInternalId,
                  msg,
                  threadInternalId
                )
              )
            );
          }
        }
      }

      console.log(`Finished processing messages for server: ${server.name}`);
    }
  } catch (error) {
    console.error("Error processing servers:", error);
  }
});

module.exports = client;
