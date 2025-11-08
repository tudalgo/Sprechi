import {
  ApplicationCommandOptionType,
  Colors,
  CommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from "discord.js"
import { Discord, Slash, SlashGroup, SlashOption } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import logger from "@utils/logger"

@Discord()
@SlashGroup({ name: "admin", description: "Admin commands" })
@SlashGroup({ name: "queue", description: "Queue management commands", root: "admin" })
export class AdminQueueCreate {
  private queueManager = new QueueManager()

  @Slash({ name: "create", description: "Create a new queue" })
  @SlashGroup("queue", "admin")
  async create(
    @SlashOption({
      name: "name",
      description: "The name of the queue",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    name: string,
    @SlashOption({
      name: "description",
      description: "The description of the queue",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    description: string,
    interaction: CommandInteraction,
  ): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({
        content: "This command can only be used in a server.",
        ephemeral: true,
      })
      return
    }

    const guildId = interaction.guild.id

    try {
      const existing = await this.queueManager.getQueueByName(guildId, name)
      if (existing) {
        await interaction.reply({
          embeds: [this.queueAlreadyExistsEmbed(name)],
          flags: MessageFlags.Ephemeral,
        })
        return
      }

      const newQueue = await this.queueManager.createQueue({
        guildId,
        name,
        description,
      })

      await interaction.reply({
        embeds: [this.queueCreatedEmbed(newQueue.name, newQueue.description)],
        flags: MessageFlags.Ephemeral,
      })
    } catch (error) {
      logger.error("Error creating queue:", error)
      await interaction.reply({
        embeds: [this.queueCreateFailedEmbed(name)],
        flags: MessageFlags.Ephemeral,
      })
    }
  }

  private queueCreatedEmbed(queueName: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(":white_check_mark: Queue Created")
      .setDescription(`**${queueName}**\n${description}`)
      .setColor(Colors.Green)
  }

  private queueAlreadyExistsEmbed(queueName: string): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(":x: Queue Already Exists")
      .setDescription(`A queue named **${queueName}** already exists in this server.`)
      .setColor(Colors.Red)
  }

  private queueCreateFailedEmbed(queueName: string): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(":x: Queue Creation Failed")
      .setDescription(`Failed to create the queue **${queueName}**.`)
      .setColor(Colors.Red)
  }
}
