const pool = require("../../config/db");

async function saveChannel(serverInternalId, channel) {
  const query = `
    INSERT INTO channel (discord_id, fk_server_id, name)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE
      fk_server_id = IF(fk_server_id <> VALUES(fk_server_id), VALUES(fk_server_id), fk_server_id),
      name = IF(name <> VALUES(name), VALUES(name), name),
      id = LAST_INSERT_ID(id)
  `;
  const [result] = await pool.query(query, [
    channel.id,
    serverInternalId,
    channel.name,
  ]);
  return result.insertId;
}

module.exports = { saveChannel };
