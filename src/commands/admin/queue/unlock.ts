import { CommandInteraction, ApplicationCommandOptionType, EmbedBuilder, Colors, MessageFlags } from "discord.js"
import { Discord, Slash, SlashOption, SlashGroup } from "discordx"
import { QueueManager } from "@managers/QueueManager"
import { inject, injectable } from "tsyringe"

@Discord()
@injectable()
@SlashGroup("queue", "admin")
export class AdminQueueUnlockCommand {
  constructor(
    @inject(QueueManager) private queueManager: QueueManager
  ) { }

  @Slash({ name: "unlock", description: "Unlock a queue" })
  async unlock(
    @SlashOption({
      name: "name",
      description: "The name of the queue to unlock",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    name: string,
    interaction: CommandInteraction
  ) {
    if (!interaction.guildId) return

    await interaction.deferReply({ flags: MessageFlags.Ephemeral })

    try {
      await this.queueManager.setQueueLockState(interaction.guildId, name, false)

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Queue Unlocked")
            .setDescription(`Queue **${name}** has been unlocked.`)
            .setColor(Colors.Green),
        ],
      })
    } catch (error: any) {
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setTitle("Error")
            .setDescription(error.message || "An error occurred while unlocking the queue.")
            .setColor(Colors.Red),
        ],
      })
    }
  }
}
