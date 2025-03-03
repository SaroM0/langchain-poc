const pool = require("../../config/db");
const { upsertUser, upsertChannelUser } = require("./user.service");

async function saveMessage(
  serverInternalId,
  channelInternalId,
  message,
  threadInternalId = null
) {
  const userNick = message.member
    ? message.member.nickname || message.author.username
    : message.author.username;
  const userInternalId = await upsertUser(
    message.author.id,
    serverInternalId,
    message.author.username,
    userNick
  );

  const query = `
    INSERT INTO message (discord_id, fk_channel_id, fk_thread_id, fk_user_id, content, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      content = IF(content <> VALUES(content), VALUES(content), content),
      id = LAST_INSERT_ID(id)
  `;
  const [result] = await pool.query(query, [
    message.id,
    channelInternalId,
    threadInternalId,
    userInternalId,
    message.content,
    message.createdAt,
  ]);
  const messageInternalId = result.insertId;

  // Record the user's participation in the channel.
  await upsertChannelUser(channelInternalId, userInternalId, message.createdAt);

  // Process attachments.
  if (message.attachments && message.attachments.size > 0) {
    await Promise.all(
      Array.from(message.attachments.values()).map(async (attachment) => {
        const attachmentQuery = `
          INSERT INTO message_attachment (fk_message_id, attachment_url, created_at)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE created_at = IF(created_at <> VALUES(created_at), VALUES(created_at), created_at)
        `;
        await pool.query(attachmentQuery, [
          messageInternalId,
          attachment.url,
          new Date(),
        ]);
      })
    );
  }

  // Process reactions.
  if (message.reactions && message.reactions.cache.size > 0) {
    for (const reaction of message.reactions.cache.values()) {
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
          const reactionQuery = `
            INSERT INTO message_reaction (fk_message_id, fk_user_id, reaction_type, created_at)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE created_at = IF(created_at <> VALUES(created_at), VALUES(created_at), created_at)
          `;
          await pool.query(reactionQuery, [
            messageInternalId,
            reactionUserInternalId,
            reaction.emoji.name,
            new Date(),
          ]);
        })
      );
    }
  }

  // Process mentions.
  await saveMessageMentions(messageInternalId, message);

  return messageInternalId;
}

async function saveMessageMentions(messageInternalId, message) {
  // Process user mentions.
  if (message.mentions.users && message.mentions.users.size > 0) {
    for (const user of message.mentions.users.values()) {
      const mentionQuery = `
        INSERT INTO message_mention (fk_message_id, mention_type, target_id, created_at)
        VALUES (?, 'user', ?, ?)
      `;
      await pool.query(mentionQuery, [messageInternalId, user.id, new Date()]);
    }
  }
  // Process role mentions.
  if (message.mentions.roles && message.mentions.roles.size > 0) {
    for (const role of message.mentions.roles.values()) {
      const mentionQuery = `
        INSERT INTO message_mention (fk_message_id, mention_type, target_id, created_at)
        VALUES (?, 'role', ?, ?)
      `;
      await pool.query(mentionQuery, [messageInternalId, role.id, new Date()]);
    }
  }
  // Process @everyone and @here mentions.
  if (message.mentions.everyone) {
    if (message.content.includes("@everyone")) {
      const mentionQuery = `
        INSERT INTO message_mention (fk_message_id, mention_type, target_id, created_at)
        VALUES (?, 'all', NULL, ?)
      `;
      await pool.query(mentionQuery, [messageInternalId, new Date()]);
    }
    if (message.content.includes("@here")) {
      const mentionQuery = `
        INSERT INTO message_mention (fk_message_id, mention_type, target_id, created_at)
        VALUES (?, 'here', NULL, ?)
      `;
      await pool.query(mentionQuery, [messageInternalId, new Date()]);
    }
  }
}

module.exports = { saveMessage, saveMessageMentions };
