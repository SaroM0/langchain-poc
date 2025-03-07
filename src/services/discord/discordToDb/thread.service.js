const Thread = require("../../../models/db/thread.model");
const Message = require("../../../models/db/message.model");

/**
 * Saves or updates a thread in the database.
 *
 * @param {number} parentChannelInternalId - The internal ID of the parent channel.
 * @param {object} thread - The Discord thread object.
 * @returns {Promise<number>} The internal ID of the saved thread.
 */
async function saveThread(parentChannelInternalId, thread) {
  const title = thread.name || thread.title;
  const description = thread.topic || "";
  const created_at = thread.createdAt || new Date();

  // Perform an upsert based on the thread's Discord ID.
  await Thread.upsert({
    discord_id: thread.id,
    fk_channel_id: parentChannelInternalId,
    title,
    description,
    created_at,
  });

  // Retrieve the saved record to return its internal ID.
  const savedThread = await Thread.findOne({
    where: { discord_id: thread.id },
  });
  return savedThread.id;
}

/**
 * Updates the parent message reference for a given message.
 *
 * @param {number} messageInternalId - The internal ID of the child message.
 * @param {string} parentDiscordMessageId - The Discord ID of the parent message.
 * @returns {Promise<void>}
 */
async function updateMessageParent(messageInternalId, parentDiscordMessageId) {
  try {
    // Find the parent message record by its Discord ID.
    const parentMessage = await Message.findOne({
      where: { discord_id: parentDiscordMessageId },
    });

    if (!parentMessage) {
      console.warn(
        `Parent message with discord_id ${parentDiscordMessageId} not found.`
      );
      return;
    }

    // Update the child message record to reference the parent's internal ID.
    await Message.update(
      { fk_parent_message_id: parentMessage.id },
      { where: { id: messageInternalId } }
    );
  } catch (error) {
    console.error(
      `Error updating parent message for message id ${messageInternalId}:`,
      error
    );
    throw error;
  }
}

module.exports = { saveThread, updateMessageParent };
