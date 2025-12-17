import { IntentsBitField, Partials, type Interaction, type Message } from "discord.js"
import { Client } from "discordx"

export const bot = new Client({
  // Use guild commands in development for instant updates
  // Use global commands in production for availability across all guilds
  ...(process.env.NODE_ENV !== "production" && {
    botGuilds: [client => client.guilds.cache.map(guild => guild.id)],
  }),

  // Discord intents
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.GuildMessageReactions,
    IntentsBitField.Flags.GuildVoiceStates,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.DirectMessages,
  ],

  partials: [
    Partials.Channel,
    Partials.Message,
  ],

  // Debug logs are disabled in silent mode
  silent: false,

  // Configuration for @SimpleCommand
  simpleCommand: {
    prefix: "!",
  },
})

bot.once("clientReady", () => {
  // Make sure all guilds are cached
  // await bot.guilds.fetch();

  // Synchronize applications commands with Discord
  void bot.initApplicationCommands()

  // To clear all guild commands, uncomment this line,
  // This is useful when moving from guild commands to global commands
  // It must only be executed once
  //
  //  await bot.clearApplicationCommands(
  //    ...bot.guilds.cache.map((g) => g.id)
  //  );
})

bot.on("interactionCreate", (interaction: Interaction) => {
  bot.executeInteraction(interaction)
})

bot.on("messageCreate", (message: Message) => {
  void bot.executeCommand(message)
})
