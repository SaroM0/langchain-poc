const Channel = require("../../../models/db/channel.model");

async function saveChannel(serverInternalId, channel) {
  // Find or create the channel record based on its discord_id.
  const [channelRecord, created] = await Channel.findOrCreate({
    where: { discord_id: channel.id },
    defaults: {
      fk_server_id: serverInternalId,
      name: channel.name,
      channel_type: channel.type, // Assumes API provides a "type" field
      created_at: channel.createdAt, // Assumes API provides a "createdAt" field
      is_indexed: false, // Default value
    },
  });

  // If the channel already exists, update its properties if needed.
  let needUpdate = false;
  if (!created) {
    if (channelRecord.fk_server_id !== serverInternalId) {
      channelRecord.fk_server_id = serverInternalId;
      needUpdate = true;
    }
    if (channelRecord.name !== channel.name) {
      channelRecord.name = channel.name;
      needUpdate = true;
    }
    if (channelRecord.channel_type !== channel.type) {
      channelRecord.channel_type = channel.type;
      needUpdate = true;
    }
    // Compare creation date using getTime for date equality.
    if (
      channel.createdAt &&
      (!channelRecord.created_at ||
        channelRecord.created_at.getTime() !==
          new Date(channel.createdAt).getTime())
    ) {
      channelRecord.created_at = channel.createdAt;
      needUpdate = true;
    }
    if (needUpdate) {
      await channelRecord.save();
    }
  }

  // Return the internal ID of the channel.
  return channelRecord.id;
}

module.exports = { saveChannel };
