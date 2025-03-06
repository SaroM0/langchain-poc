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

async function processChannelMessages(channel) {
  try {
    // Recuperar mensajes para el canal con asociaciones relevantes.
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
          attributes: ["id"],
        },
      ],
      order: [["created_at", "ASC"]],
    });

    console.log(
      `Processing messages for channel "${channel.name}" (id ${channel.id})... Found ${messages.length} messages.`
    );

    if (!messages || messages.length === 0) {
      console.log(
        `Channel "${channel.name}" (id ${channel.id}) has no messages to vectorize.`
      );
      return;
    }

    // Inicializar el índice de Pinecone para este canal.
    const indexName = `channel-${channel.id}`;
    const index = await initPinecone(indexName);

    for (const message of messages) {
      // Verificar si el mensaje ya fue vectorizado (asumiendo que message.is_vectorized existe).
      if (message.is_vectorized) {
        console.log(`Message ${message.id} is already vectorized. Skipping.`);
        continue;
      }

      // Omitir mensajes vacíos.
      if (!message.content || message.content.trim() === "") continue;

      let text = message.content;
      // Si el mensaje pertenece a un thread, agregar el título del thread para contexto.
      if (message.Thread && message.Thread.id) {
        text = `[Thread: ${message.Thread.title}] ${text}`;
      }

      let embedding;
      try {
        // Generar el embedding utilizando la API de embeddings (por ejemplo, de OpenAI).
        embedding = await openaiEmbeddings.embedQuery(text);
      } catch (error) {
        console.warn(
          `Skipping message ${message.id} due to embedding error: ${error.message}`
        );
        continue;
      }

      console.log(
        `Generated embedding for message ${message.id} in channel "${channel.name}". Embedding length: ${embedding.length}`
      );

      if (!embedding || !Array.isArray(embedding) || embedding.length === 0) {
        console.warn(
          `Skipping message ${message.id} because embedding is invalid or empty.`
        );
        continue;
      }

      // Convertir created_at a timestamp numérico.
      const createdAtNumber = new Date(message.created_at).getTime();

      // Extraer roles asociados al usuario.
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

      // Contar las reacciones del mensaje.
      const numberOfReactions = message.MessageReactions
        ? message.MessageReactions.length
        : 0;

      // Preparar el objeto vector para upsert en Pinecone.
      const vector = {
        id: message.discord_id.toString(), // Usar el ID de Discord como identificador del vector.
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
      };

      // Upsert inmediato en Pinecone.
      try {
        console.log(
          `Upserting embedding for message ${message.id} into Pinecone index "${indexName}".`
        );
        // Se envuelve el vector en un arreglo, ya que la función upsert espera una lista.
        await index.upsert([vector], "");
        // Marcar el mensaje como vectorizado (aquí se asume que message.is_vectorized existe y se actualiza en memoria; opcionalmente, actualizar la DB).
        message.is_vectorized = true;
      } catch (error) {
        console.error(
          `Error upserting message ${message.id} into Pinecone: ${error.message}`
        );
      }
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
