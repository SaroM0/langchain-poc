const Organization = require("./organization.model");
const Server = require("./server.model");
const User = require("./user.model");
const Role = require("./role.model");
const UserRole = require("./userRole.model");
const Channel = require("./channel.model");
const ChannelUser = require("./channelUser.model");
const Thread = require("./thread.model");
const Message = require("./message.model");
const MessageAttachment = require("./messageAttachment.model");
const MessageReaction = require("./messageReaction.model");
const TrendingTopic = require("./trendingTopic.model");
const MessageMention = require("./messageMention.model");

// Associations

// Organization -> Server
Organization.hasMany(Server, { foreignKey: "fk_organization_id" });
Server.belongsTo(Organization, { foreignKey: "fk_organization_id" });

// Server -> User
Server.hasMany(User, { foreignKey: "fk_server_id" });
User.belongsTo(Server, { foreignKey: "fk_server_id" });

// Server -> Channel
Server.hasMany(Channel, { foreignKey: "fk_server_id" });
Channel.belongsTo(Server, { foreignKey: "fk_server_id" });

// Channel -> Thread
Channel.hasMany(Thread, { foreignKey: "fk_channel_id" });
Thread.belongsTo(Channel, { foreignKey: "fk_channel_id" });

// Channel -> Message
Channel.hasMany(Message, { foreignKey: "fk_channel_id" });
Message.belongsTo(Channel, { foreignKey: "fk_channel_id" });

// Thread -> Message
Thread.hasMany(Message, { foreignKey: "fk_thread_id" });
Message.belongsTo(Thread, { foreignKey: "fk_thread_id" });

// User -> Message
User.hasMany(Message, { foreignKey: "fk_user_id" });
Message.belongsTo(User, { foreignKey: "fk_user_id" });

// Message -> Message (Parent-Child relationship)
Message.hasMany(Message, { foreignKey: "fk_parent_message_id", as: "Replies" });
Message.belongsTo(Message, {
  foreignKey: "fk_parent_message_id",
  as: "Parent",
});

// Channel -> ChannelUser
Channel.hasMany(ChannelUser, { foreignKey: "fk_channel_id" });
ChannelUser.belongsTo(Channel, { foreignKey: "fk_channel_id" });

// User -> ChannelUser
User.hasMany(ChannelUser, { foreignKey: "fk_user_id" });
ChannelUser.belongsTo(User, { foreignKey: "fk_user_id" });

// User -> UserRole
User.hasMany(UserRole, { foreignKey: "fk_user_id" });
UserRole.belongsTo(User, { foreignKey: "fk_user_id" });

// Role -> UserRole
Role.hasMany(UserRole, { foreignKey: "fk_role_id" });
UserRole.belongsTo(Role, { foreignKey: "fk_role_id" });

// Message -> MessageAttachment
Message.hasMany(MessageAttachment, { foreignKey: "message_id" });
MessageAttachment.belongsTo(Message, { foreignKey: "message_id" });

// Message -> MessageReaction
Message.hasMany(MessageReaction, { foreignKey: "fk_message_id" });
MessageReaction.belongsTo(Message, { foreignKey: "fk_message_id" });

// User -> MessageReaction
User.hasMany(MessageReaction, { foreignKey: "fk_user_id" });
MessageReaction.belongsTo(User, { foreignKey: "fk_user_id" });

// Channel -> TrendingTopic
Channel.hasMany(TrendingTopic, { foreignKey: "fk_channel_id" });
TrendingTopic.belongsTo(Channel, { foreignKey: "fk_channel_id" });

// Message -> MessageMention
Message.hasMany(MessageMention, { foreignKey: "fk_message_id" });
MessageMention.belongsTo(Message, { foreignKey: "fk_message_id" });

module.exports = {
  Organization,
  Server,
  User,
  Role,
  UserRole,
  Channel,
  ChannelUser,
  Thread,
  Message,
  MessageAttachment,
  MessageReaction,
  TrendingTopic,
  MessageMention,
};
