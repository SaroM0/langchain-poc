require("dotenv").config();

const { openaiEmbeddings } = require("../../config/openai.config");
const { Pinecone: PineconeClient } = require("@pinecone-database/pinecone");
const {
  initPinecone,
  listPineconeIndexes,
} = require("../../config/pinecone.config");
const {
  Channel,
  Message,
  Thread,
  User,
  UserRole,
  Role,
  MessageReaction,
} = require("../../models/db");

const { sleep } = require("../../utils/functionHandler");

const DIMENSION = 3072;
const METRIC = "cosine";

/**
 * Splits an array into chunks of a specified size.
 * @param {Array} array - The array to split.
 * @param {number} size - The size of each chunk.
 * @returns {Array<Array>} - An array of chunks.
 */
function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Creates a Pinecone index for a given channel if it doesn't already exist.
 * The index is created with the specified dimension and metric.
 * @param {Object} channel - The channel object.
 */
async function createIndexForChannel(channel) {
  const indexName = `channel-${channel.id}`;
  const indexes = await listPineconeIndexes();

  if (indexes.includes(indexName)) {
    console.log(
      `Index "${indexName}" already exists for channel "${channel.name}". Skipping creation.`
    );
    return;
  }

  try {
    const client = new PineconeClient();
    // Create the index with the specified configuration.
    await client.createIndex({
      name: indexName,
      dimension: DIMENSION,
      metric: METRIC,
      spec: {
        serverless: {
          cloud: "aws",
          region: "us-east-1",
        },
      },
    });
    console.log(
      `Index "${indexName}" created successfully for channel "${channel.name}".`
    );
    // Wait for the index to be fully ready.
    console.log(`Waiting for index "${indexName}" to be ready...`);
    await sleep(10000);
  } catch (error) {
    console.error(
      `Error creating index for channel "${channel.name}": ${error.message}`
    );
  }
}

/**
 * Retrieves channels that have messages and creates an index for each new channel.
 * This function can be scheduled to run periodically to handle new channels.
 */
async function createIndicesForNewChannels(channelsList = null) {
  try {
    let channels;
    if (channelsList && channelsList.length > 0) {
      channels = channelsList;
      console.log(`Received ${channels.length} channels for vectorization.`);
    } else {
      // Retrieve channels that have at least one associated message.
      channels = await Channel.findAll({
        include: [
          {
            model: Message,
            required: true,
          },
        ],
      });
      console.log(`Found ${channels.length} channels with messages.`);
    }

    for (const channel of channels) {
      await createIndexForChannel(channel);
    }
  } catch (error) {
    console.error("Error retrieving channels:", error);
  }
}

/**
 * Processes messages for a given channel by generating embeddings and upserting them into the corresponding Pinecone index.
 * This function can be called to vectorize all messages or solo los mensajes nuevos que aún no fueron procesados.
 * @param {Object} channel - The channel object.
 */
async function processChannelMessages(channel) {
  try {
    // Retrieve messages for the channel with associated User (including UserRoles and Role), Thread, and MessageReaction.
    const messages = await Message.findAll({
      where: { fk_channel_id: channel.id },
      include: [
        {
          model: User,
          attributes: ["id", "name", "discord_id"],
          include: [
            {
              model: UserRole,
              include: [
                {
                  model: Role,
                  attributes: ["name"],
                },
              ],
            },
          ],
        },
        {
          model: Thread,
          attributes: ["id", "title"],
        },
        {
          model: MessageReaction,
          attributes: ["id"], // Only needed for counting reactions.
        },
      ],
      order: [["created_at", "ASC"]],
    });

    if (!messages || messages.length === 0) {
      console.log(
        `Channel "${channel.name}" (id ${channel.id}) has no messages to vectorize.`
      );
      return;
    }

    const embeddingsData = [];

    for (const message of messages) {
      // Skip empty messages.
      if (!message.content || message.content.trim() === "") continue;

      let text = message.content;
      // If the message is part of a thread, prepend the thread title for context.
      if (message.Thread && message.Thread.id) {
        text = `[Thread: ${message.Thread.title}] ${text}`;
      }

      let embedding;
      try {
        // Generate the embedding using LangChain's OpenAI embeddings.
        embedding = await openaiEmbeddings.embedQuery(text);
      } catch (error) {
        console.warn(
          `Skipping message ${message.id} due to embedding error: ${error.message}`
        );
        continue;
      }

      if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
        console.warn(
          `Skipping message ${message.id} because embedding is invalid or empty.`
        );
        continue;
      }

      // Convert created_at to a numeric timestamp.
      const createdAtNumber = new Date(message.created_at).getTime();

      // Retrieve all roles associated with the user.
      let userRoles = [];
      if (
        message.User &&
        message.User.UserRoles &&
        message.User.UserRoles.length > 0
      ) {
        userRoles = message.User.UserRoles.map((userRole) =>
          userRole.Role && userRole.Role.name ? userRole.Role.name : null
        ).filter(Boolean);
      }

      // Count the number of reactions for the message.
      const numberOfReactions = message.MessageReactions
        ? message.MessageReactions.length
        : 0;

      // Prepare the data for upsert into Pinecone.
      embeddingsData.push({
        id: message.discord_id.toString(), // Use the Discord message ID as the vector identifier.
        values: embedding,
        metadata: {
          discord_id: message.discord_id,
          channel_id: message.fk_channel_id,
          thread_id: message.fk_thread_id
            ? message.fk_thread_id.toString()
            : "",
          user_id: message.fk_user_id,
          parent_message_id: message.fk_parent_message_id
            ? message.fk_parent_message_id.toString()
            : "",
          content: message.content,
          created_at: createdAtNumber,
          user_role: userRoles,
          number_of_reactions: numberOfReactions,
        },
      });
    }

    if (embeddingsData.length === 0) {
      console.log(
        `No valid embeddings generated for channel "${channel.name}".`
      );
      return;
    }

    const indexName = `channel-${channel.id}`;
    // Initialize the Pinecone index instance.
    const index = await initPinecone(indexName);

    // Split the embeddings data into batches to avoid payload limits.
    const batches = chunkArray(embeddingsData, 100);
    for (const [i, batch] of batches.entries()) {
      console.log(
        `Upserting batch ${i + 1} of ${batches.length} for channel "${
          channel.name
        }"...`
      );
      await index.upsert(batch, "");
    }
    console.log(`Finished upserting messages for channel "${channel.name}".`);
  } catch (error) {
    console.error(
      `Error processing messages for channel "${channel.name}":`,
      error
    );
  }
}

module.exports = {
  createIndicesForNewChannels,
  processChannelMessages,
};
