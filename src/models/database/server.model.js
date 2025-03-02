const { DataTypes } = require("sequelize");
const sequelize = require("../../config/sequelize.config");

const Server = sequelize.define(
  "Server",
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
    fk_organization_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
    },
    description: {
      type: DataTypes.STRING,
    },
    created_at: {
      type: DataTypes.DATE,
    },
  },
  {
    tableName: "server",
    timestamps: false,
  }
);

module.exports = Server;
