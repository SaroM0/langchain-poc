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

module.exports = MessageReaction;
