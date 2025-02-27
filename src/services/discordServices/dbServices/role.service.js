const pool = require("../../config/db");

async function saveRole(role) {
  const query = `
    INSERT INTO role (name, description, created_at)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE
      name = IF(name <> VALUES(name), VALUES(name), name),
      description = IF(description <> VALUES(description), VALUES(description), description)
  `;
  const created_at = new Date();
  const description = role.hoist ? "Hoisted role" : "";
  const [result] = await pool.query(query, [
    role.name,
    description,
    created_at,
  ]);
  return result.insertId;
}

module.exports = { saveRole };
