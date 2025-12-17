import {
  ApplicationCommandOptionType,
  Colors,
  CommandInteraction,
  EmbedBuilder,
} from "discord.js"
import { Discord, Slash, SlashGroup, SlashOption } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import logger from "@utils/logger"
import { inject, injectable } from "tsyringe"
import { adminQueueCommands } from "@config/messages"

@Discord()
@injectable()
@SlashGroup({ name: "admin", description: "Admin commands" })
@SlashGroup({ name: "queue", description: "Queue management commands", root: "admin" })
export class AdminQueueCreate {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "create", description: adminQueueCommands.create.description, dmPermission: false })
  @SlashGroup("queue", "admin")
  async create(
    @SlashOption({
      name: "name",
      description: adminQueueCommands.create.optionName,
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    name: string,
    @SlashOption({
      name: "description",
      description: adminQueueCommands.create.optionDescription,
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
      })
    } catch (error) {
      logger.error("Error creating queue:", error)
      await interaction.reply({
        embeds: [this.queueCreateFailedEmbed(name)],
      })
    }
  }

  private queueCreatedEmbed(queueName: string, description: string): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(adminQueueCommands.create.success.title)
      .setDescription(adminQueueCommands.create.success.description(queueName, description))
      .setColor(Colors.Green)
  }

  private queueAlreadyExistsEmbed(queueName: string): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(adminQueueCommands.create.duplicateQueue.title)
      .setDescription(adminQueueCommands.create.duplicateQueue.description(queueName))
      .setColor(Colors.Red)
  }

  private queueCreateFailedEmbed(queueName: string): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(adminQueueCommands.create.failure.title)
      .setDescription(adminQueueCommands.create.failure.description(queueName))
      .setColor(Colors.Red)
  }
}
