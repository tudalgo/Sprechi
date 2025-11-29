import {
  ApplicationCommandOptionType,
  CommandInteraction,
  EmbedBuilder,
  Colors,
  MessageFlags,
  ChannelType,
  VoiceChannel,
  TextChannel,
} from "discord.js"
import { Discord, Slash, SlashGroup, SlashOption } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import { QueueNotFoundError } from "../../../errors/QueueErrors"

@Discord()
@SlashGroup("queue")
export class AdminQueueConfig {
  private queueManager = new QueueManager()

  @Slash({ name: "waiting-room", description: "Set the waiting room for a queue" })
  async setWaitingRoom(
    @SlashOption({
      name: "name",
      description: "The name of the queue",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    name: string,
    @SlashOption({
      name: "channel",
      description: "The voice channel to use as waiting room",
      required: true,
      type: ApplicationCommandOptionType.Channel,
      channelTypes: [ChannelType.GuildVoice],
    })
    channel: VoiceChannel,
    interaction: CommandInteraction,
  ): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    try {
      await this.queueManager.setWaitingRoom(interaction.guild.id, name, channel.id)

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Waiting Room Set")
            .setDescription(`Waiting room for queue **${name}** set to <#${channel.id}>.`)
            .setColor(Colors.Green),
        ],
        flags: MessageFlags.Ephemeral,
      })
    } catch (error: unknown) {
      let errorMessage = "Failed to set waiting room."
      if (error instanceof QueueNotFoundError) {
        errorMessage = `Queue **${name}** not found.`
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Error")
            .setDescription(errorMessage)
            .setColor(Colors.Red),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }
  }

  @Slash({ name: "log-channel", description: "Set the log channel for a queue" })
  async setLogChannel(
    @SlashOption({
      name: "name",
      description: "The name of the queue",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    name: string,
    @SlashOption({
      name: "channel",
      description: "The text channel to use for logs",
      required: true,
      type: ApplicationCommandOptionType.Channel,
      channelTypes: [ChannelType.GuildText],
    })
    channel: TextChannel,
    interaction: CommandInteraction,
  ): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        flags: MessageFlags.Ephemeral,
      })
      return
    }

    try {
      await this.queueManager.setLogChannel(interaction.guild.id, name, channel.id)

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Log Channel Set")
            .setDescription(`Log channel for queue **${name}** set to <#${channel.id}>.`)
            .setColor(Colors.Green),
        ],
        flags: MessageFlags.Ephemeral,
      })
    } catch (error: unknown) {
      let errorMessage = "Failed to set log channel."
      if (error instanceof QueueNotFoundError) {
        errorMessage = `Queue **${name}** not found.`
      }

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Error")
            .setDescription(errorMessage)
            .setColor(Colors.Red),
        ],
        flags: MessageFlags.Ephemeral,
      })
    }
  }
}
