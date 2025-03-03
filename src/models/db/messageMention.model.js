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

module.exports = MessageMention;
