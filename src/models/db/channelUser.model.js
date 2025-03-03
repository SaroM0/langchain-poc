const { DataTypes } = require("sequelize");
const sequelize = require("../../config/sequelize.config");

const ChannelUser = sequelize.define(
  "ChannelUser",
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
    fk_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    is_featured: {
      type: DataTypes.BOOLEAN,
    },
    joined_at: {
      type: DataTypes.DATE,
    },
  },
  {
    tableName: "channel_user",
    timestamps: false,
  }
);

// Add metadata: a general description and per-attribute descriptions.
ChannelUser.modelDescription =
  "Represents the relationship between a channel and a user. It includes details such as whether the user is featured and the timestamp when they joined.";
ChannelUser.attributeDescriptions = {
  id: "Unique identifier for the channel-user relationship.",
  fk_channel_id: "Foreign key linking to the channel.",
  fk_user_id: "Foreign key linking to the user.",
  is_featured:
    "Boolean indicating whether the user is featured in the channel.",
  joined_at: "Timestamp indicating when the user joined the channel.",
};

module.exports = ChannelUser;
