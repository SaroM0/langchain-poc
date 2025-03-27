const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/sequelize.config");

const MessageAttachment = sequelize.define(
  "MessageAttachment",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    fk_message_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    attachment_url: {
      type: DataTypes.TEXT,
    },
    created_at: {
      type: DataTypes.DATE,
    },
  },
  {
    tableName: "message_attachment",
    timestamps: false,
  }
);

MessageAttachment.modelDescription =
  "Represents an attachment associated with a message. This model stores the URL of the attachment, the associated message foreign key, and its creation timestamp.";
MessageAttachment.attributeDescriptions = {
  id: "Unique identifier for the message attachment record.",
  fk_message_id: "Foreign key linking the attachment to a specific message.",
  attachment_url: "The URL of the attachment.",
  created_at: "Timestamp indicating when the attachment was created.",
};

module.exports = MessageAttachment;
