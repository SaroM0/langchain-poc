const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/sequelize.config");

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

Thread.modelDescription =
  "Represents a discussion thread within a channel. This model stores the associated channel ID, the unique Discord thread ID, the thread title, a description, and its creation timestamp.";
Thread.attributeDescriptions = {
  id: "Unique identifier for the thread record.",
  fk_channel_id: "Foreign key linking the thread to its parent channel.",
  discord_id: "Unique Discord identifier for the thread.",
  title: "The title of the thread.",
  description: "A detailed description of the thread's topic.",
  created_at: "Timestamp indicating when the thread was created.",
};

module.exports = Thread;
