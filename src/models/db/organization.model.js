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

Organization.modelDescription =
  "Represents an organization entity. This model stores the organization's name and the creation timestamp.";
Organization.attributeDescriptions = {
  id: "Unique identifier for the organization.",
  name: "The name of the organization.",
  created_at: "Timestamp indicating when the organization was created.",
};

module.exports = Organization;
