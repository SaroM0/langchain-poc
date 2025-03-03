const pool = require("../../config/db");

async function ensureOrganization() {
  const orgName = "straico";
  const [rows] = await pool.query(
    "SELECT id FROM organization WHERE name = ?",
    [orgName]
  );
  if (rows.length > 0) {
    return rows[0].id;
  } else {
    const created_at = new Date();
    const [result] = await pool.query(
      "INSERT INTO organization (name, created_at) VALUES (?, ?)",
      [orgName, created_at]
    );
    return result.insertId;
  }
}

module.exports = { ensureOrganization };
