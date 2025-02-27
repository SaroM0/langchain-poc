const pool = require("../../config/db");

async function saveThread(parentChannelInternalId, thread) {
  const query = `
    INSERT INTO thread (discord_id, fk_channel_id, title, description, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      title = IF(title <> VALUES(title), VALUES(title), title),
      description = IF(description <> VALUES(description), VALUES(description), description),
      id = LAST_INSERT_ID(id)
  `;
  const title = thread.name || thread.title;
  const description = thread.topic || "";
  const created_at = thread.createdAt || new Date();
  const [result] = await pool.query(query, [
    thread.id,
    parentChannelInternalId,
    title,
    description,
    created_at,
  ]);
  return result.insertId;
}

module.exports = { saveThread };
