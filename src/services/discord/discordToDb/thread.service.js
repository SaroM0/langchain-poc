const Thread = require("../../../models/db/thread.model");

async function saveThread(parentChannelInternalId, thread) {
  const title = thread.name || thread.title;
  const description = thread.topic || "";
  const created_at = thread.createdAt || new Date();

  // Se realiza un upsert basado en el discord_id del thread.
  await Thread.upsert({
    discord_id: thread.id,
    fk_channel_id: parentChannelInternalId,
    title,
    description,
    created_at,
  });

  // Se busca el registro para retornar su ID interno.
  const savedThread = await Thread.findOne({
    where: { discord_id: thread.id },
  });
  return savedThread.id;
}

module.exports = { saveThread };
