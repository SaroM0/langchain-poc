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

module.exports = ChannelUser;
