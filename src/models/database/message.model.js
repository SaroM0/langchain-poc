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

module.exports = Message;
