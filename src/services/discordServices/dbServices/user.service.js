const pool = require("../../config/db");

async function upsertUser(
  discordUserId,
  serverInternalId,
  globalUserName,
  serverNickname
) {
  const query = `
    INSERT INTO \`user\` (id, discord_id, fk_server_id, name, nick)
    VALUES (NULL, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      fk_server_id = IF(fk_server_id <> VALUES(fk_server_id), VALUES(fk_server_id), fk_server_id),
      name = IF(name <> VALUES(name), VALUES(name), name),
      nick = IF(nick <> VALUES(nick), VALUES(nick), nick),
      id = LAST_INSERT_ID(id)
  `;
  const [result] = await pool.query(query, [
    discordUserId,
    serverInternalId,
    globalUserName,
    serverNickname,
  ]);
  return result.insertId;
}

async function upsertChannelUser(channelInternalId, userInternalId, joinedAt) {
  const query = `
    INSERT INTO channel_user (fk_channel_id, fk_user_id, joined_at)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE joined_at = IF(joined_at <> VALUES(joined_at), VALUES(joined_at), joined_at)
  `;
  await pool.query(query, [channelInternalId, userInternalId, joinedAt]);
}

module.exports = { upsertUser, upsertChannelUser };
