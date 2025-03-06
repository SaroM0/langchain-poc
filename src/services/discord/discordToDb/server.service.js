const Server = require("../../../models/db/server.model");

async function saveServer(server, organizationId) {
  await Server.upsert({
    discord_id: server.id,
    fk_organization_id: organizationId,
    name: server.name,
    created_at: server.createdAt,
  });

  // Buscar el registro para retornar su ID interno.
  const savedServer = await Server.findOne({
    where: { discord_id: server.id },
  });
  return savedServer.id;
}

module.exports = { saveServer };
