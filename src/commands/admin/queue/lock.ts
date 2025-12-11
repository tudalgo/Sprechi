import {
  ApplicationCommandOptionType,
  CommandInteraction,
  EmbedBuilder,
  Colors,
  MessageFlags,
} from "discord.js"
import { Discord, Slash, SlashGroup, SlashOption } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import { inject, injectable } from "tsyringe"

@Discord()
@injectable()
@SlashGroup("queue", "admin")
export class AdminQueueLockCommand {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager,
  ) { }

  @Slash({ name: "lock", description: "Lock a queue", dmPermission: false })
  async lock(
    @SlashOption({
      name: "name",
      description: "The name of the queue to lock",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    name: string,
    interaction: CommandInteraction,
  ): Promise<void> {
    if (!interaction.guildId) return

    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    try {
      await this.queueManager.setScheduleEnabled(interaction.guildId, name, false)
      await this.queueManager.setQueueLockState(interaction.guildId, name, true)

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Queue Locked")
            .setDescription(`Queue **${name}** has been locked.`)
            .setColor(Colors.Red),
        ],
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "An error occurred."
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Error")
            .setDescription(message)
            .setColor(Colors.Red),
        ],
      })
    }
  }
}
