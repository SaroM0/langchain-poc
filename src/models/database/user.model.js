const { DataTypes } = require("sequelize");
const sequelize = require("../../config/sequelize.config");

const User = sequelize.define(
  "User",
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
    nick: {
      type: DataTypes.STRING,
    },
    name: {
      type: DataTypes.STRING,
    },
    joined_at: {
      type: DataTypes.DATE,
    },
  },
  {
    tableName: "user",
    timestamps: false,
  }
);

module.exports = User;
