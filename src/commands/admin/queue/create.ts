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
import { inject, injectable } from "tsyringe"

@Discord()
@injectable()
@SlashGroup({ name: "admin", description: "Admin commands" })
@SlashGroup({ name: "queue", description: "Queue management commands", root: "admin" })
export class AdminQueueCreate {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "create", description: "Create a new queue", dmPermission: false })
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
    logger.info(`Command 'create queue' triggered by ${interaction.user.username} (${interaction.user.id}) for queue '${name}'`)

    if (!interaction.guild) return

    const guildId = interaction.guild.id

    try {
      const existing = await this.queueManager.getQueueByName(guildId, name)
      if (existing) {
        logger.warn(`Failed to create queue '${name}': Queue already exists in guild '${interaction.guild.id}'`)
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

      logger.info(`Queue '${newQueue.name}' created in guild '${interaction.guild.name}' (${interaction.guild.id})`)

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
