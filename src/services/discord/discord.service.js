const client = require("../../config/discordClient");
const { ensureOrganization } = require("./discordToDb/organization.service");
const { upsertUser } = require("./discordToDb/user.service");
const { saveUserRole } = require("./discordToDb/userRole.service");
const { saveServer } = require("./discordToDb/server.service");
const { saveChannel } = require("./discordToDb/channel.service");
const { saveThread } = require("./discordToDb/thread.service");
const { saveMessage } = require("./discordToDb/message.service");
const { saveRole } = require("./discordToDb/role.service");
const ChannelModel = require("../../models/db/channel.model");

// Función sleep para esperar 10 segundos (10000 ms)
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Helper function to fetch all messages from a text-based entity (channel or thread) using pagination.
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
      batch = await entity.messages.fetch(options);
    } catch (error) {
      if (error.code === 50001) {
        console.warn(
          `Missing Access for ${entity.id} while fetching messages. Skipping messages.`
        );
        await sleep(10000);
      } else {
        console.error(`Error fetching messages for ${entity.id}:`, error);
      }
      break;
    }
    if (batch.size === 0) break;
    allMessages.push(...batch.values());
    lastMessageId = batch.last().id;
  }
  return allMessages;
}

/**
 * Connects to Discord, synchronizes all data from Discord into the database and resolves when finished.
 */
async function syncDiscordData() {
  return new Promise((resolve, reject) => {
    client.once("ready", async () => {
      try {
        console.log("Discord client is ready. Starting synchronization...");
        // 1. Organization
        const organizationId = await ensureOrganization();
        console.log("Organization ensured with ID:", organizationId);
        await sleep(10000);

        // Iterar sobre cada servidor (guild)
        for (const [guildId, server] of client.guilds.cache) {
          console.log(`Processing server: ${server.name} (${server.id})`);
          const serverInternalId = await saveServer(server, organizationId);
          console.log(`Server saved with internal ID: ${serverInternalId}`);
          await sleep(10000);

          // 2. Users: Procesar miembros
          await server.members.fetch();
          server.members.cache.forEach((member) => {
            console.log(
              "Full member object for",
              member.user.username,
              ":",
              JSON.stringify(member, null, 2)
            );
          });
          await sleep(10000);
          await Promise.all(
            Array.from(server.members.cache.values()).map(async (member) => {
              try {
                if (!member.joinedAt) {
                  console.warn(
                    `Member ${member.id} (${member.user.username}) has no joinedAt info.`
                  );
                  await sleep(10000);
                }
                // Imprimir "KO:" con los roles del usuario para ver qué se está recibiendo
                console.log(
                  "KO: Roles for member",
                  member.user.username,
                  JSON.stringify(Array.from(member.roles.cache.keys()))
                );
                await sleep(10000);

                const userInternalId = await upsertUser(
                  member.id,
                  serverInternalId,
                  member.user.username,
                  member.displayName,
                  member.joinedTimestamp
                );
                console.log(
                  `User ${member.user.username} saved with internal ID: ${userInternalId}`
                );
                await sleep(10000);

                // Procesar TODOS los roles (sin excluir ninguno)
                const roles = Array.from(member.roles.cache.values());
                if (roles.length === 0) {
                  console.warn(`User ${member.user.username} has no roles.`);
                  await sleep(10000);
                }
                await Promise.all(
                  roles.map(async (role) => {
                    try {
                      await saveUserRole(
                        userInternalId,
                        role.id,
                        member.joinedAt
                      );
                      console.log(
                        `Associated role ${role.name} (${role.id}) to user ${member.user.username}`
                      );
                      await sleep(10000);
                    } catch (error) {
                      console.error(
                        `Error saving user role for user ${member.id} with role ${role.id}:`,
                        error
                      );
                    }
                  })
                );
              } catch (error) {
                console.error(`Error saving user ${member.id}:`, error);
              }
            })
          );

          // 3. Roles: Procesar roles del servidor
          await Promise.all(
            Array.from(server.roles.cache.values()).map(async (role) => {
              try {
                await saveRole(role);
                console.log(`Role ${role.name} (${role.id}) saved.`);
                await sleep(10000);
              } catch (error) {
                console.error(`Error saving role ${role.id}:`, error);
              }
            })
          );

          // 4. Channels & Channel Messages:
          const nonThreadChannels = server.channels.cache.filter(
            (ch) => ch.isTextBased() && !ch.isThread()
          );
          const parentChannelMap = {};
          await Promise.all(
            Array.from(nonThreadChannels.values()).map(async (channel) => {
              let channelInternalId;
              try {
                channelInternalId = await saveChannel(
                  serverInternalId,
                  channel
                );
                parentChannelMap[channel.id] = channelInternalId;
                console.log(
                  `Channel ${channel.name} (${channel.id}) saved with ID: ${channelInternalId}`
                );
                await sleep(10000);
              } catch (error) {
                if (error.code === 50001) {
                  console.warn(
                    `Missing Access for channel ${channel.id}. Skipping channel and its messages.`
                  );
                  await sleep(10000);
                } else {
                  console.error(`Error saving channel ${channel.id}:`, error);
                }
                return;
              }
              const fetchedMessages = await fetchAllMessages(channel);
              console.log(
                `Fetched ${fetchedMessages.length} messages for channel ${channel.name}`
              );
              await sleep(10000);
              // Si no se encontraron mensajes, se elimina el canal de la DB
              if (fetchedMessages.length === 0) {
                console.warn(
                  `Channel ${channel.name} has 0 messages. Removing channel from DB.`
                );
                await sleep(10000);
                await ChannelModel.destroy({
                  where: { id: channelInternalId },
                });
                delete parentChannelMap[channel.id];
                return;
              }
              if (fetchedMessages.length > 0) {
                await Promise.all(
                  fetchedMessages.map(async (msg) => {
                    if (msg.reference) {
                      console.log(
                        "KO: Parent message reference for message",
                        msg.id,
                        JSON.stringify(msg.reference)
                      );
                      await sleep(10000);
                    }
                    await saveMessage(serverInternalId, channelInternalId, msg);
                  })
                );
              }
            })
          );

          // 5. Threads & Thread Messages:
          await Promise.all(
            Array.from(nonThreadChannels.values()).map(async (channel) => {
              const threads = new Map();
              try {
                const activeThreads = await channel.threads.fetchActive();
                activeThreads.threads.forEach((thread) => {
                  threads.set(thread.id, thread);
                });
                console.log(
                  `Channel ${channel.name}: Fetched ${activeThreads.threads.size} active threads.`
                );
                await sleep(10000);
              } catch (error) {
                console.error(
                  `Error fetching active threads for channel ${channel.id}:`,
                  error
                );
              }
              try {
                const archivedThreads = await channel.threads.fetchArchived();
                archivedThreads.threads.forEach((thread) => {
                  threads.set(thread.id, thread);
                });
                console.log(
                  `Channel ${channel.name}: Fetched ${archivedThreads.threads.size} archived threads.`
                );
                await sleep(10000);
              } catch (error) {
                console.error(
                  `Error fetching archived threads for channel ${channel.id}:`,
                  error
                );
              }
              await Promise.all(
                Array.from(threads.values()).map(async (thread) => {
                  console.log(
                    "KO: Thread object",
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
                  await sleep(10000);
                  if (![10, 11, 12].includes(thread.type)) {
                    console.warn(
                      `Thread ${thread.id} (${
                        thread.name || thread.title
                      }) is not a valid thread type. Skipping.`
                    );
                    await sleep(10000);
                    return;
                  }
                  if (!thread.parentId) {
                    console.warn(
                      `Thread ${thread.id} (${
                        thread.name || thread.title
                      }) has no parentId.`
                    );
                    await sleep(10000);
                  }
                  const parentChannelInternalId =
                    parentChannelMap[thread.parentId];
                  if (!parentChannelInternalId) {
                    console.warn(
                      `Parent channel for thread ${thread.id} not found. Skipping thread.`
                    );
                    await sleep(10000);
                    return;
                  }
                  const threadInternalId = await saveThread(
                    parentChannelInternalId,
                    thread
                  );
                  console.log(
                    `Thread ${thread.name || thread.title} (${
                      thread.id
                    }) saved with internal ID: ${threadInternalId}`
                  );
                  await sleep(10000);
                  const fetchedMessages = await fetchAllMessages(thread);
                  console.log(
                    `Fetched ${fetchedMessages.length} messages for thread ${thread.id}`
                  );
                  await sleep(10000);
                  if (fetchedMessages.length > 0) {
                    await Promise.all(
                      fetchedMessages.map(async (msg) => {
                        if (msg.reference) {
                          console.log(
                            "KO: Parent message reference in thread",
                            msg.id,
                            JSON.stringify(msg.reference)
                          );
                          await sleep(10000);
                        }
                        await saveMessage(
                          serverInternalId,
                          parentChannelInternalId,
                          msg,
                          threadInternalId
                        );
                      })
                    );
                  }
                })
              );
            })
          );

          console.log(`Finished processing data for server: ${server.name}`);
          await sleep(10000);
        }
        resolve();
      } catch (error) {
        console.error("Error processing servers:", error);
        reject(error);
      }
    });
    // Si el cliente ya está listo, ejecutar de inmediato.
    if (client.readyAt) {
      client.emit("ready");
    }
  });
}

module.exports = { syncDiscordData };
