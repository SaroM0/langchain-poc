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

module.exports = UserRole;
