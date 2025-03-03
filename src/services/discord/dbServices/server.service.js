const pool = require("../../config/db");

async function saveServer(server, organizationId) {
  const query = `
    INSERT INTO server (discord_id, fk_organization_id, name)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE
      fk_organization_id = IF(fk_organization_id <> VALUES(fk_organization_id), VALUES(fk_organization_id), fk_organization_id),
      name = IF(name <> VALUES(name), VALUES(name), name),
      id = LAST_INSERT_ID(id)
  `;
  const [result] = await pool.query(query, [
    server.id,
    organizationId,
    server.name,
  ]);
  return result.insertId;
}

module.exports = { saveServer };
