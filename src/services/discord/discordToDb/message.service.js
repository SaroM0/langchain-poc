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
        await MessageAttachment.findOrCreate({
          where: {
            message_id: messageInternalId,
            attachment_url: attachment.url,
          },
          defaults: {
            created_at: new Date(),
          },
        });
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
      await MessageMention.create({
        fk_message_id: messageInternalId,
        mention_type: "user",
        target_id: user.id,
        created_at: new Date(),
      });
    }
  }
  // Procesar menciones de rol.
  if (message.mentions.roles && message.mentions.roles.size > 0) {
    for (const role of message.mentions.roles.values()) {
      await MessageMention.create({
        fk_message_id: messageInternalId,
        mention_type: "role",
        target_id: role.id,
        created_at: new Date(),
      });
    }
  }
  // Procesar menciones @everyone y @here.
  if (message.mentions.everyone) {
    if (message.content.includes("@everyone")) {
      await MessageMention.create({
        fk_message_id: messageInternalId,
        mention_type: "all",
        target_id: null,
        created_at: new Date(),
      });
    }
    if (message.content.includes("@here")) {
      await MessageMention.create({
        fk_message_id: messageInternalId,
        mention_type: "here",
        target_id: null,
        created_at: new Date(),
      });
    }
  }
}

module.exports = { saveMessage, saveMessageMentions };
