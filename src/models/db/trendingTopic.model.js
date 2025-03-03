const { DataTypes } = require("sequelize");
const sequelize = require("../../config/sequelize.config");

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

module.exports = TrendingTopic;
