const { DataTypes } = require("sequelize");
const sequelize = require("../../config/sequelize.config");

const Organization = sequelize.define(
  "Organization",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
    },
    created_at: {
      type: DataTypes.DATE,
    },
  },
  {
    tableName: "organization",
    timestamps: false,
  }
);

module.exports = Organization;
