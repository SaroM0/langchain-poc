const Message = require("../../../models/db/message.model");
const MessageAttachment = require("../../../models/db/messageAttachment.model");
const MessageReaction = require("../../../models/db/messageReaction.model");
const MessageMention = require("../../../models/db/messageMention.model");
const { upsertUser, upsertChannelUser } = require("./user.service");

async function saveMessage(
  serverInternalId,
  channelInternalId,
  message,
  threadInternalId = null
) {
  // Determinar el nick del usuario (usando member.nickname si está disponible).
  const userNick = message.member
    ? message.member.nickname || message.author.username
    : message.author.username;

  // Asegurarse de que el usuario exista y obtener su ID interno.
  const userInternalId = await upsertUser(
    message.author.id,
    serverInternalId,
    message.author.username,
    userNick
  );

  // Buscar o crear el registro del mensaje basado en su discord_id.
  const [msgRecord, created] = await Message.findOrCreate({
    where: { discord_id: message.id },
    defaults: {
      fk_channel_id: channelInternalId,
      fk_thread_id: threadInternalId,
      fk_user_id: userInternalId,
      content: message.content,
      created_at: message.createdAt,
    },
  });

  // Si el mensaje ya existía, actualizar el contenido si es necesario.
  if (!created && msgRecord.content !== message.content) {
    msgRecord.content = message.content;
    await msgRecord.save();
  }
  const messageInternalId = msgRecord.id;

  // Registrar la participación del usuario en el canal.
  await upsertChannelUser(channelInternalId, userInternalId, message.createdAt);

  // Procesar attachments (adjuntos).
  if (message.attachments && message.attachments.size > 0) {
    await Promise.all(
      Array.from(message.attachments.values()).map(async (attachment) => {
        try {
          await MessageAttachment.findOrCreate({
            where: {
              fk_message_id: messageInternalId,
              attachment_url: attachment.url,
            },
            defaults: {
              created_at: new Date(),
            },
          });
        } catch (error) {
          console.error(
            `Error creating attachment for message ID ${messageInternalId} and attachment URL ${attachment.url}:`,
            error
          );
        }
      })
    );
  }

  // Procesar reactions.
  if (message.reactions && message.reactions.cache.size > 0) {
    for (const reaction of message.reactions.cache.values()) {
      // Se obtienen los usuarios que reaccionaron (limitando el tiempo de la consulta).
      const users = await reaction.users.fetch({ time: 3600000 });
      await Promise.all(
        Array.from(users.values()).map(async (user) => {
          try {
            const reactionUserNick = user.nickname || user.username;
            const reactionUserInternalId = await upsertUser(
              user.id,
              serverInternalId,
              user.username,
              reactionUserNick
            );
            await MessageReaction.findOrCreate({
              where: {
                fk_message_id: messageInternalId,
                fk_user_id: reactionUserInternalId,
                reaction_type: reaction.emoji.name,
              },
              defaults: {
                created_at: new Date(),
              },
            });
          } catch (error) {
            console.error(
              `Error creating reaction for message ID ${messageInternalId} and user ${user.id}:`,
              error
            );
          }
        })
      );
    }
  }

  // Procesar menciones.
  await saveMessageMentions(messageInternalId, message);

  return messageInternalId;
}

async function saveMessageMentions(messageInternalId, message) {
  // Procesar menciones de usuario.
  if (message.mentions.users && message.mentions.users.size > 0) {
    for (const user of message.mentions.users.values()) {
      try {
        await MessageMention.create({
          fk_message_id: messageInternalId,
          mention_type: "user",
          target_id: user.id,
          created_at: new Date(),
        });
      } catch (error) {
        console.error(
          `Error creating user mention for message ID ${messageInternalId} and user ${user.id}:`,
          error
        );
      }
    }
  }
  // Procesar menciones de rol.
  if (message.mentions.roles && message.mentions.roles.size > 0) {
    for (const role of message.mentions.roles.values()) {
      try {
        await MessageMention.create({
          fk_message_id: messageInternalId,
          mention_type: "role",
          target_id: role.id,
          created_at: new Date(),
        });
      } catch (error) {
        console.error(
          `Error creating role mention for message ID ${messageInternalId} and role ${role.id}:`,
          error
        );
      }
    }
  }
  // Procesar menciones @everyone y @here.
  if (message.mentions.everyone) {
    if (message.content.includes("@everyone")) {
      try {
        await MessageMention.create({
          fk_message_id: messageInternalId,
          mention_type: "all",
          target_id: null,
          created_at: new Date(),
        });
      } catch (error) {
        console.error(
          `Error creating @everyone mention for message ID ${messageInternalId}:`,
          error
        );
      }
    }
    if (message.content.includes("@here")) {
      try {
        await MessageMention.create({
          fk_message_id: messageInternalId,
          mention_type: "here",
          target_id: null,
          created_at: new Date(),
        });
      } catch (error) {
        console.error(
          `Error creating @here mention for message ID ${messageInternalId}:`,
          error
        );
      }
    }
  }
}

module.exports = { saveMessage, saveMessageMentions };
