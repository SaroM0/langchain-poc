const { DataTypes } = require("sequelize");
const sequelize = require("../../config/sequelize.config");

const MessageMention = sequelize.define(
  "MessageMention",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    fk_message_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    mention_type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    target_id: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
    },
  },
  {
    tableName: "message_mention",
    timestamps: false,
  }
);

MessageMention.modelDescription =
  "Represents a mention within a message. This model captures the type of mention (e.g., user, role, channel), the target identifier, and the creation timestamp, along with the associated message.";
MessageMention.attributeDescriptions = {
  id: "Unique identifier for the message mention record.",
  fk_message_id: "Foreign key linking the mention to a specific message.",
  mention_type: "The type of mention (e.g., user, role, channel).",
  target_id: "Identifier of the target that is mentioned.",
  created_at: "Timestamp indicating when the mention was created.",
};

module.exports = MessageMention;
