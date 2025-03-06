const { DataTypes } = require("sequelize");
const sequelize = require("../../config/sequelize.config");

const Role = sequelize.define(
  "Role",
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
      comment: "ID asignado por Discord para el rol",
    },
    name: {
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
    tableName: "role",
    timestamps: false,
  }
);

Role.modelDescription =
  "Represents a role that can be assigned to users. This model stores the role's name, its Discord-assigned id, a description of its purpose, and the creation timestamp.";
Role.attributeDescriptions = {
  id: "Unique identifier for the role.",
  discord_id: "Discord-assigned ID for the role.",
  name: "The name of the role.",
  description: "A detailed description of the role and its responsibilities.",
  created_at: "Timestamp indicating when the role was created.",
};

module.exports = Role;
