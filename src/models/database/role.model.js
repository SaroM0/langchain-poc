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

module.exports = Role;
