const User = require("../../../models/db/user.model");
const ChannelUser = require("../../../models/db/channelUser.model");

async function upsertUser(
  discordUserId,
  serverInternalId,
  globalUserName,
  serverNickname,
  joinedAt
) {
  // Se realiza el upsert basándonos en el discord_id.
  await User.upsert({
    discord_id: discordUserId,
    fk_server_id: serverInternalId,
    name: globalUserName,
    nick: serverNickname,
    joined_at: joinedAt,
  });
  // Buscar el registro para retornar su ID interno.
  const userRecord = await User.findOne({
    where: { discord_id: discordUserId },
  });
  return userRecord.id;
}

async function upsertChannelUser(channelInternalId, userInternalId, joinedAt) {
  // "joinedAt" es la fecha en la que el usuario entró al servidor, proveniente de la API.
  const [channelUser, created] = await ChannelUser.findOrCreate({
    where: { fk_channel_id: channelInternalId, fk_user_id: userInternalId },
    defaults: { joined_at: joinedAt },
  });
  // Si ya existía y la fecha de ingreso es distinta a la proporcionada por la API, se actualiza.
  if (
    !created &&
    channelUser.joined_at.getTime() !== new Date(joinedAt).getTime()
  ) {
    channelUser.joined_at = joinedAt;
    await channelUser.save();
  }
}

module.exports = { upsertUser, upsertChannelUser };
