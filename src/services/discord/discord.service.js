const client = require("../../config/discordClient");
const { ensureOrganization } = require("./discordToDb/organization.service");
const { upsertUser } = require("./discordToDb/user.service");
const { saveUserRole } = require("./discordToDb/userRole.service");
const { saveServer } = require("./discordToDb/server.service");
const { saveChannel } = require("./discordToDb/channel.service");
const { saveThread } = require("./discordToDb/thread.service");
const { saveMessage } = require("./discordToDb/message.service");
const { saveRole } = require("./discordToDb/role.service");

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
        // 1. Organization: Asegurar que la organización existe (todas las propiedades disponibles).
        const organizationId = await ensureOrganization();

        // Iterar sobre cada servidor (guild) en el caché de Discord.
        for (const [guildId, server] of client.guilds.cache) {
          /**
           * "server" contiene propiedades como id, name, icon, splash, discovery_splash, owner_id,
           * afk_channel_id, afk_timeout, widget_enabled, widget_channel_id, verification_level,
           * default_message_notifications, explicit_content_filter, roles, emojis, features, mfa_level,
           * description, banner, etc.
           */
          const serverInternalId = await saveServer(server, organizationId);

          // 2. Users: Forzar la carga de todos los miembros y procesarlos.
          await server.members.fetch();
          await Promise.all(
            Array.from(server.members.cache.values()).map(async (member) => {
              try {
                // Se pasan las propiedades disponibles: id, member.user.username, member.nickname (o fallback)
                // y member.joinedAt (la fecha en que el usuario entró al servidor).
                const userInternalId = await upsertUser(
                  member.id,
                  serverInternalId,
                  member.user.username,
                  member.nickname || member.user.username,
                  member.joinedAt
                );
                // Asociar cada rol que tenga el usuario (excluyendo el rol @everyone).
                await Promise.all(
                  Array.from(member.roles.cache.values()).map(async (role) => {
                    if (role.id === server.id) return; // omitir @everyone
                    try {
                      await saveUserRole(
                        userInternalId,
                        role.id,
                        member.joinedAt
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
                console.error(`Error saving user ${member.id}:`, error);
              }
            })
          );

          // 3. Roles: Procesar y guardar cada rol del servidor (excepto @everyone).
          await Promise.all(
            Array.from(server.roles.cache.values()).map(async (role) => {
              if (role.id === server.id) return;
              try {
                await saveRole(role);
              } catch (error) {
                console.error(`Error saving role ${role.id}:`, error);
              }
            })
          );

          // 4. Channels & Channel Messages:
          // Filtrar canales de texto (no threads) con todas sus propiedades (id, name, type, topic, createdAt, etc.)
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
              } catch (error) {
                if (error.code === 50001) {
                  console.warn(
                    `Missing Access for channel ${channel.id}. Skipping channel and its messages.`
                  );
                } else {
                  console.error(`Error saving channel ${channel.id}:`, error);
                }
                return;
              }
              // Obtener y guardar todos los mensajes del canal.
              const fetchedMessages = await fetchAllMessages(channel);
              if (fetchedMessages.length > 0) {
                await Promise.all(
                  fetchedMessages.map(async (msg) => {
                    await saveMessage(serverInternalId, channelInternalId, msg);
                  })
                );
              }
            })
          );

          // 5. Threads & Thread Messages:
          // Para cada canal de texto (no thread), procesar threads activos y archivados.
          await Promise.all(
            Array.from(nonThreadChannels.values()).map(async (channel) => {
              const threads = new Map();
              try {
                const activeThreads = await channel.threads.fetchActive();
                activeThreads.threads.forEach((thread) =>
                  threads.set(thread.id, thread)
                );
              } catch (error) {
                console.error(
                  `Error fetching active threads for channel ${channel.id}:`,
                  error
                );
              }
              try {
                const archivedThreads = await channel.threads.fetchArchived();
                archivedThreads.threads.forEach((thread) =>
                  threads.set(thread.id, thread)
                );
              } catch (error) {
                console.error(
                  `Error fetching archived threads for channel ${channel.id}:`,
                  error
                );
              }
              await Promise.all(
                Array.from(threads.values()).map(async (thread) => {
                  if (![10, 11, 12].includes(thread.type)) {
                    console.warn(
                      `Thread ${thread.id} is not a valid thread type. Skipping.`
                    );
                    return;
                  }
                  const parentChannelInternalId =
                    parentChannelMap[thread.parentId];
                  if (!parentChannelInternalId) {
                    console.warn(
                      `Parent channel for thread ${thread.id} not found. Skipping thread.`
                    );
                    return;
                  }
                  const threadInternalId = await saveThread(
                    parentChannelInternalId,
                    thread
                  );
                  const fetchedMessages = await fetchAllMessages(thread);
                  if (fetchedMessages.length > 0) {
                    await Promise.all(
                      fetchedMessages.map(async (msg) => {
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
        }
        resolve();
      } catch (error) {
        console.error("Error processing servers:", error);
        reject(error);
      }
    });
    // En caso de que el cliente ya esté listo, se puede verificar y ejecutar de inmediato.
    if (client.readyAt) {
      // Si ya está listo, forzamos la ejecución inmediata.
      client.emit("ready");
    }
  });
}

module.exports = { syncDiscordData };
