const { DataTypes } = require("sequelize");
const sequelize = require("../../config/sequelize.config");

const MessageReaction = sequelize.define(
  "MessageReaction",
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
    fk_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    reaction_type: {
      type: DataTypes.STRING,
    },
    created_at: {
      type: DataTypes.DATE,
    },
  },
  {
    tableName: "message_reaction",
    timestamps: false,
  }
);

MessageReaction.modelDescription =
  "Represents a reaction to a message. This model captures the type of reaction, along with the associated message and user, and the timestamp when the reaction was made.";
MessageReaction.attributeDescriptions = {
  id: "Unique identifier for the message reaction record.",
  fk_message_id: "Foreign key linking the reaction to a specific message.",
  fk_user_id: "Foreign key linking the reaction to the user who reacted.",
  reaction_type: "The type of reaction (e.g., like, emoji, etc.).",
  created_at: "Timestamp indicating when the reaction was created.",
};

module.exports = MessageReaction;
