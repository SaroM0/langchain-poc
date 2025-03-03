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

User.modelDescription =
  "Represents a Discord user within a server. This model stores the unique Discord ID, the associated server, the user's nickname and full name, as well as the date they joined.";
User.attributeDescriptions = {
  id: "Unique identifier for the user record.",
  discord_id: "Unique Discord identifier for the user.",
  fk_server_id: "Foreign key linking the user to a specific server.",
  nick: "The nickname of the user on Discord.",
  name: "The full name of the user.",
  joined_at: "Timestamp indicating when the user joined the server.",
};

module.exports = User;
