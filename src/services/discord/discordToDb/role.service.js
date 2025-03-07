const Role = require("../../../models/db/role.model");

async function saveRole(role) {
  const created_at = new Date();
  // Use the "hoist" field to define the description (example)
  const description = role.hoist ? "Hoisted role" : "";

  // Upsert: Update the role if it exists (identified by discord_id) or create it if it doesn't.
  await Role.upsert({
    discord_id: role.id, // Discord-assigned identifier
    name: role.name,
    description,
    created_at,
  });

  // Retrieve the record to obtain its internal ID.
  const savedRole = await Role.findOne({ where: { discord_id: role.id } });
  return savedRole.id;
}

module.exports = { saveRole };
