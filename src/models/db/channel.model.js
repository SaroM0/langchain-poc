const { DataTypes } = require("sequelize");
const sequelize = require("../../config/sequelize.config");

const Channel = sequelize.define(
  "Channel",
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
    fk_server_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
    },
    channel_type: {
      type: DataTypes.STRING,
    },
    created_at: {
      type: DataTypes.DATE,
    },
  },
  {
    tableName: "channel",
    timestamps: false,
  }
);

// Add model metadata: a general description and per-attribute descriptions.
Channel.modelDescription =
  "Represents a communication channel on a Discord server. This model stores key details such as the unique Discord ID, the associated server, the channel name, type, and creation date.";
Channel.attributeDescriptions = {
  id: "Unique identifier for the channel.",
  discord_id: "Unique Discord identifier for the channel.",
  fk_server_id: "Foreign key linking the channel to its server.",
  name: "The name of the channel.",
  channel_type: "The type of the channel (e.g., text, voice).",
  created_at: "Timestamp indicating when the channel was created.",
};

module.exports = Channel;
