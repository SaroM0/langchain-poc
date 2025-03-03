const { DataTypes } = require("sequelize");
const sequelize = require("../../config/sequelize.config");

const Message = sequelize.define(
  "Message",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    discord_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      unique: true,
    },
    fk_channel_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    fk_thread_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    fk_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    fk_parent_message_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    content: {
      type: DataTypes.TEXT,
    },
    created_at: {
      type: DataTypes.DATE,
    },
  },
  {
    tableName: "message",
    timestamps: false,
  }
);

Message.modelDescription =
  "Represents a message sent in a Discord channel or thread. This model captures the unique Discord message ID, the associated channel, thread, user, any parent message for replies, the message content, and its creation timestamp.";
Message.attributeDescriptions = {
  id: "Unique identifier for the message record.",
  discord_id: "Unique Discord identifier for the message.",
  fk_channel_id: "Foreign key linking the message to its channel.",
  fk_thread_id:
    "Foreign key linking the message to its thread (if applicable).",
  fk_user_id: "Foreign key linking the message to the user who sent it.",
  fk_parent_message_id:
    "Foreign key linking the message to its parent message (for replies).",
  content: "The textual content of the message.",
  created_at: "Timestamp indicating when the message was created.",
};

module.exports = Message;
