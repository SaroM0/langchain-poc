const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/sequelize.config");

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

Server.modelDescription =
  "Represents a Discord server entity associated with an organization. It stores the unique Discord ID, organization reference, server name, description, and creation timestamp.";
Server.attributeDescriptions = {
  id: "Unique identifier for the server record.",
  discord_id: "Unique Discord identifier for the server.",
  fk_organization_id: "Foreign key linking the server to its organization.",
  name: "The name of the server.",
  description: "A brief description of the server.",
  created_at: "Timestamp indicating when the server was created.",
};

module.exports = Server;
