const { DataTypes } = require("sequelize");
const sequelize = require("../../config/sequelize.config");

const Thread = sequelize.define(
  "Thread",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    fk_channel_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    discord_id: {
      type: DataTypes.BIGINT,
      allowNull: false,
      unique: true,
    },
    title: {
      type: DataTypes.STRING,
    },
    description: {
      type: DataTypes.TEXT,
    },
    created_at: {
      type: DataTypes.DATE,
    },
  },
  {
    tableName: "thread",
    timestamps: false,
  }
);

module.exports = Thread;
