const { DataTypes } = require("sequelize");
const sequelize = require("../../config/sequelize.config");

const MessageAttachment = sequelize.define(
  "MessageAttachment",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    message_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    attachment_url: {
      type: DataTypes.TEXT,
    },
    created_at: {
      type: DataTypes.DATE,
    },
  },
  {
    tableName: "message_attachment",
    timestamps: false,
  }
);

module.exports = MessageAttachment;
