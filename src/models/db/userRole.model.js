const { DataTypes } = require("sequelize");
const sequelize = require("../../config/sequelize.config");

const UserRole = sequelize.define(
  "UserRole",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    fk_user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    fk_role_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    assigned_at: {
      type: DataTypes.DATE,
    },
  },
  {
    tableName: "user_role",
    timestamps: false,
  }
);

UserRole.modelDescription =
  "Represents the association between a user and a role. This model stores which role is assigned to which user and the timestamp when the assignment was made.";
UserRole.attributeDescriptions = {
  id: "Unique identifier for the user-role assignment record.",
  fk_user_id: "Foreign key linking to the user.",
  fk_role_id: "Foreign key linking to the role.",
  assigned_at: "Timestamp indicating when the role was assigned to the user.",
};

module.exports = UserRole;
