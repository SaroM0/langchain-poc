const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/sequelize.config");

const TrendingTopic = sequelize.define(
  "TrendingTopic",
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
    description: {
      type: DataTypes.STRING,
    },
    created_at: {
      type: DataTypes.DATE,
    },
  },
  {
    tableName: "trending_topic",
    timestamps: false,
  }
);

TrendingTopic.modelDescription =
  "Represents a trending topic within a channel. This model stores the channel association, a brief description of the trending topic, and its creation timestamp.";
TrendingTopic.attributeDescriptions = {
  id: "Unique identifier for the trending topic record.",
  fk_channel_id: "Foreign key linking the trending topic to its channel.",
  description: "A brief description of the trending topic.",
  created_at: "Timestamp indicating when the trending topic was created.",
};

module.exports = TrendingTopic;
