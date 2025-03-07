const client = require("../../config/discordClient");
const { ensureOrganization } = require("./discordToDb/organization.service");
const { upsertUser } = require("./discordToDb/user.service");
const { saveUserRole } = require("./discordToDb/userRole.service");
const { saveServer } = require("./discordToDb/server.service");
const { saveChannel } = require("./discordToDb/channel.service");
const {
  saveThread,
  updateMessageParent,
} = require("./discordToDb/thread.service");
const { saveMessage } = require("./discordToDb/message.service");
const { saveRole } = require("./discordToDb/role.service");
const {
  saveMessageAttachment,
} = require("./discordToDb/messageAttachment.servicervice");
const ChannelModel = require("../../models/db/channel.model");

// Sleep function to wait for a given number of milliseconds
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Helper function to call API functions with retries for handling rate limits and transient errors.
 * @param {Function} apiFunction - The API function to call.
 * @param {Array} args - The arguments to pass to the API function.
 * @param {number} retries - Number of retries allowed.
 * @param {number} delay - Delay in milliseconds before retrying.
 * @returns {Promise<any>}
 */
async function apiCallWithRetries(
  apiFunction,
  args = [],
  retries = 3,
  delay = 1000
) {
  try {
    return await apiFunction(...args);
  } catch (error) {
    // Check if error indicates a rate limit or transient error (e.g., code 429 for rate limit)
    if (retries > 0 && (error.code === 429 || error.code === 50001)) {
      console.warn(
        `API rate limit or transient error encountered (code: ${error.code}). Retrying in ${delay}ms...`
      );
      await sleep(delay);
      return await apiCallWithRetries(
        apiFunction,
        args,
        retries - 1,
        delay * 2
      );
    }
    throw error;
  }
}

/**
 * Helper function to fetch all messages from a text-based entity (channel or thread) using pagination.
 * Uses the apiCallWithRetries helper to handle rate limits.
 * @param {TextChannel|ThreadChannel} entity - The channel or thread object.
 * @returns {Promise<Array>} - An array with all fetched messages.
 */
async function fetchAllMessages(entity) {
  const allMessages = [];
  let lastMessageId = null;
  while (true) {
    const options = { limit: 100 };
    if (lastMessageId) options.before = lastMessageId;
    let batch;
    try {
      batch = await apiCallWithRetries(
        entity.messages.fetch.bind(entity.messages),
        [options]
      );
    } catch (error) {
      console.error(`Error fetching messages for entity ${entity.id}:`, error);
      break;
    }
    if (batch.size === 0) break;
    allMessages.push(...batch.values());
    lastMessageId = batch.last().id;
  }
  return allMessages;
}

/**
 * Process members of a guild.
 */
async function processMembers(server, serverInternalId) {
  await server.members.fetch();
  // For debugging: log complete member objects if necessary.
  server.members.cache.forEach((member) => {
    console.log(
      "Full member object for",
      member.user.username,
      ":",
      JSON.stringify(member, null, 2)
    );
  });

  await Promise.all(
    Array.from(server.members.cache.values()).map(async (member) => {
      try {
        if (!member.joinedAt) {
          console.warn(
            `Member ${member.id} (${member.user.username}) has no joinedAt info.`
          );
        }
        console.log(
          "Member roles for",
          member.user.username,
          ":",
          JSON.stringify(Array.from(member.roles.cache.keys()))
        );
        const userInternalId = await upsertUser(
          member.id,
          serverInternalId,
          member.user.username,
          member.nickname ? member.nickname : member.displayName,
          member.joinedTimestamp
        );
        console.log(
          `User ${member.user.username} saved with internal ID: ${userInternalId}`
        );

        const roles = Array.from(member.roles.cache.values());
        if (roles.length === 0) {
          console.warn(`User ${member.user.username} has no roles.`);
        }
        await Promise.all(
          roles.map(async (role) => {
            try {
              await saveUserRole(userInternalId, role.id, member.joinedAt);
              console.log(
                `Associated role ${role.name} (${role.id}) to user ${member.user.username}`
              );
            } catch (error) {
              console.error(
                `Error saving user role for user ${member.id} with role ${role.id}:`,
                error
              );
            }
          })
        );
      } catch (error) {
        console.error(`Error processing member ${member.id}:`, error);
      }
    })
  );
}

/**
 * Process server roles.
 */
async function processRoles(server) {
  await Promise.all(
    Array.from(server.roles.cache.values()).map(async (role) => {
      try {
        await saveRole(role);
        console.log(`Role ${role.name} (${role.id}) saved.`);
      } catch (error) {
        console.error(`Error saving role ${role.id}:`, error);
      }
    })
  );
}

/**
 * Process channels and their messages.
 */
async function processChannels(server, serverInternalId) {
  const nonThreadChannels = server.channels.cache.filter(
    (ch) => ch.isTextBased() && !ch.isThread()
  );
  const parentChannelMap = {};

  await Promise.all(
    Array.from(nonThreadChannels.values()).map(async (channel) => {
      let channelInternalId;
      try {
        channelInternalId = await saveChannel(serverInternalId, channel);
        parentChannelMap[channel.id] = channelInternalId;
        console.log(
          `Channel ${channel.name} (${channel.id}) saved with ID: ${channelInternalId}`
        );
      } catch (error) {
        if (error.code === 50001) {
          console.warn(
            `Missing access for channel ${channel.id}. Skipping channel and its messages.`
          );
        } else {
          console.error(`Error saving channel ${channel.id}:`, error);
        }
        return;
      }
      const fetchedMessages = await fetchAllMessages(channel);
      console.log(
        `Fetched ${fetchedMessages.length} messages for channel ${channel.name}`
      );

      if (fetchedMessages.length === 0) {
        console.warn(
          `Channel ${channel.name} has 0 messages. Removing channel from DB.`
        );
        await ChannelModel.destroy({ where: { id: channelInternalId } });
        delete parentChannelMap[channel.id];
        return;
      }
      await Promise.all(
        fetchedMessages.map(async (msg) => {
          if (msg.reference) {
            console.log(
              "Message",
              msg.id,
              "has a parent message reference:",
              JSON.stringify(msg.reference)
            );
          }
          // Save the message and capture its internal ID.
          const messageInternalId = await saveMessage(
            serverInternalId,
            channelInternalId,
            msg
          );
          // Process attachments if any.
          if (msg.attachments && msg.attachments.size > 0) {
            await processMessageAttachments(messageInternalId, msg);
          }
          // Process message reference to update fk_parent_message_id.
          if (msg.reference && msg.reference.messageId) {
            await updateMessageParent(
              messageInternalId,
              msg.reference.messageId
            );
          }
        })
      );
    })
  );

  return parentChannelMap;
}

/**
 * Process threads and their messages.
 */
async function processThreads(
  nonThreadChannels,
  serverInternalId,
  parentChannelMap
) {
  await Promise.all(
    Array.from(nonThreadChannels.values()).map(async (channel) => {
      const threads = new Map();
      // Fetch active threads
      try {
        const activeThreads = await apiCallWithRetries(
          channel.threads.fetchActive.bind(channel.threads)
        );
        activeThreads.threads.forEach((thread) =>
          threads.set(thread.id, thread)
        );
        console.log(
          `Channel ${channel.name}: Fetched ${activeThreads.threads.size} active threads.`
        );
      } catch (error) {
        console.error(
          `Error fetching active threads for channel ${channel.id}:`,
          error
        );
      }
      // Fetch archived threads
      try {
        const archivedThreads = await apiCallWithRetries(
          channel.threads.fetchArchived.bind(channel.threads)
        );
        archivedThreads.threads.forEach((thread) =>
          threads.set(thread.id, thread)
        );
        console.log(
          `Channel ${channel.name}: Fetched ${archivedThreads.threads.size} archived threads.`
        );
      } catch (error) {
        console.error(
          `Error fetching archived threads for channel ${channel.id}:`,
          error
        );
      }

      await Promise.all(
        Array.from(threads.values()).map(async (thread) => {
          console.log(
            "Processing thread:",
            JSON.stringify({
              id: thread.id,
              name: thread.name,
              title: thread.title,
              topic: thread.topic,
              createdAt: thread.createdAt,
              parentId: thread.parentId,
              type: thread.type,
            })
          );

          // Validate thread type (example: valid types 10, 11, 12)
          if (![10, 11, 12].includes(thread.type)) {
            console.warn(
              `Thread ${thread.id} is not a valid thread type. Skipping.`
            );
            return;
          }
          if (!thread.parentId) {
            console.warn(`Thread ${thread.id} has no parentId.`);
          }
          const parentChannelInternalId = parentChannelMap[thread.parentId];
          if (!parentChannelInternalId) {
            console.warn(
              `Parent channel for thread ${thread.id} not found. Skipping thread.`
            );
            return;
          }
          // Save the thread and capture its internal ID.
          const threadInternalId = await saveThread(
            parentChannelInternalId,
            thread
          );
          console.log(
            `Thread ${thread.name || thread.title} (${
              thread.id
            }) saved with internal ID: ${threadInternalId}`
          );

          const fetchedMessages = await fetchAllMessages(thread);
          console.log(
            `Fetched ${fetchedMessages.length} messages for thread ${thread.id}`
          );

          await Promise.all(
            fetchedMessages.map(async (msg) => {
              if (msg.reference) {
                console.log(
                  "Thread message",
                  msg.id,
                  "has a parent message reference:",
                  JSON.stringify(msg.reference)
                );
              }
              // Save the message within the thread.
              const messageInternalId = await saveMessage(
                serverInternalId,
                parentChannelInternalId,
                msg,
                threadInternalId
              );
              // Process attachments if any.
              if (msg.attachments && msg.attachments.size > 0) {
                await processMessageAttachments(messageInternalId, msg);
              }
              // Process message reference to update fk_parent_message_id.
              if (msg.reference && msg.reference.messageId) {
                await updateMessageParent(
                  messageInternalId,
                  msg.reference.messageId
                );
              }
            })
          );
        })
      );
    })
  );
}

/**
 * Helper function to process and save message attachments.
 * @param {number} messageInternalId - The internal ID of the saved message.
 * @param {object} msg - The Discord message object.
 */
async function processMessageAttachments(messageInternalId, msg) {
  await Promise.all(
    Array.from(msg.attachments.values()).map(async (attachment) => {
      try {
        await saveMessageAttachment(
          messageInternalId,
          attachment.url,
          new Date()
        );
        console.log(`Attachment ${attachment.url} saved for message ${msg.id}`);
      } catch (error) {
        console.error(
          `Error saving attachment ${attachment.url} for message ${msg.id}:`,
          error
        );
      }
    })
  );
}

/**
 * Main function to synchronize Discord data with the database.
 */
async function syncDiscordData() {
  return new Promise((resolve, reject) => {
    client.once("ready", async () => {
      try {
        console.log("Discord client is ready. Starting synchronization...");
        // 1. Organization: Ensure organization exists.
        const organizationId = await ensureOrganization();
        console.log("Organization ensured with ID:", organizationId);

        // Iterate over each server (guild) in the Discord cache.
        for (const [guildId, server] of client.guilds.cache) {
          console.log(`Processing server: ${server.name} (${server.id})`);
          const serverInternalId = await saveServer(server, organizationId);
          console.log(`Server saved with internal ID: ${serverInternalId}`);

          // Process members, roles, channels and threads concurrently.
          await Promise.all([
            processMembers(server, serverInternalId),
            processRoles(server),
          ]);

          // Process channels and get a mapping of channel IDs.
          const parentChannelMap = await processChannels(
            server,
            serverInternalId
          );

          // Process threads based on non-thread channels.
          const nonThreadChannels = server.channels.cache.filter(
            (ch) => ch.isTextBased() && !ch.isThread()
          );
          await processThreads(
            nonThreadChannels,
            serverInternalId,
            parentChannelMap
          );

          console.log(`Finished processing data for server: ${server.name}`);
        }
        resolve();
      } catch (error) {
        console.error("Error processing servers:", error);
        reject(error);
      }
    });
    // If the client is already ready, emit "ready" immediately.
    if (client.readyAt) {
      client.emit("ready");
    }
  });
}

module.exports = { syncDiscordData };
