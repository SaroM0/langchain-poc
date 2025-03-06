require("dotenv").config();

// Import modules from discord.js
const { Client, GatewayIntentBits } = require("discord.js");

// Create a Discord client with intents to access guilds, messages, and message content
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, // Receive events related to guilds (servers)
    GatewayIntentBits.GuildMembers, // Fetch and receive guild member updates (privileged)
    GatewayIntentBits.GuildBans, // Receive guild ban events
    GatewayIntentBits.GuildEmojisAndStickers, // Access custom emojis and stickers in guilds
    GatewayIntentBits.GuildIntegrations, // Receive events about integrations in guilds
    GatewayIntentBits.GuildWebhooks, // Manage and receive webhook events
    GatewayIntentBits.GuildInvites, // Access guild invite events and data
    GatewayIntentBits.GuildVoiceStates, // Receive voice state updates in guilds
    GatewayIntentBits.GuildPresences, // Receive presence updates (e.g., online status) (privileged)
    GatewayIntentBits.GuildMessages, // Receive messages from guild text channels
    GatewayIntentBits.GuildMessageReactions, // Receive reaction events in guilds
    GatewayIntentBits.GuildMessageTyping, // Receive typing events in guild text channels
    GatewayIntentBits.DirectMessages, // Receive direct messages (DMs) from users
    GatewayIntentBits.DirectMessageReactions, // Receive reaction events in DMs
    GatewayIntentBits.DirectMessageTyping, // Receive typing events in DMs
    GatewayIntentBits.MessageContent, // Access the content of messages (privileged)
    GatewayIntentBits.GuildScheduledEvents, // Receive events related to scheduled events in guilds
    GatewayIntentBits.AutoModerationConfiguration, // Manage auto-moderation configuration (privileged)
    GatewayIntentBits.AutoModerationExecution, // Receive auto-moderation execution events (privileged)
  ],
});

// Event triggered when the bot successfully connects to Discord
client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Log in to Discord using the token stored in .env
client.login(process.env.DISCORD_TOKEN);

// Export the client so it can be used in other parts of the application
module.exports = client;
