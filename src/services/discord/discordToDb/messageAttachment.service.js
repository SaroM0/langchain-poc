const MessageAttachment = require("../../../models/db/messageAttachment.model");

/**
 * Saves a message attachment in the database.
 *
 * @param {number} messageInternalId - The internal ID of the message.
 * @param {string} attachmentUrl - The URL of the attachment.
 * @param {Date} createdAt - The timestamp when the attachment was created.
 * @returns {Promise<object>} The created or found MessageAttachment record.
 */
async function saveMessageAttachment(
  messageInternalId,
  attachmentUrl,
  createdAt
) {
  try {
    const [attachmentRecord, created] = await MessageAttachment.findOrCreate({
      where: {
        message_id: messageInternalId,
        attachment_url: attachmentUrl,
      },
      defaults: {
        created_at: createdAt,
      },
    });
    return attachmentRecord;
  } catch (error) {
    console.error(
      `Error saving attachment for message ID ${messageInternalId}:`,
      error
    );
    throw error;
  }
}

module.exports = { saveMessageAttachment };
