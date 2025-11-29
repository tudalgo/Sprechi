import {
  ApplicationCommandOptionType,
  CommandInteraction,
  EmbedBuilder,
  Colors,
  MessageFlags,
} from "discord.js"
import { Discord, Slash, SlashGroup, SlashOption } from "discordx"
import { QueueManager } from "@managers/QueueManager"

@Discord()
@SlashGroup("queue")
export class AdminQueueLock {
  private queueManager = new QueueManager()

  @Slash({ name: "lock", description: "Lock or unlock a queue" })
  async lock(
    @SlashOption({
      name: "name",
      description: "The name of the queue to lock/unlock",
      required: true,
      type: ApplicationCommandOptionType.String,
    })
    name: string,
    @SlashOption({
      name: "state",
      description: "True to lock, False to unlock",
      required: true,
      type: ApplicationCommandOptionType.Boolean,
    })
    state: boolean,
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
      await this.queueManager.toggleLock(interaction.guild.id, name, state)

      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(state ? "Queue Locked" : "Queue Unlocked")
            .setDescription(`Queue **${name}** has been ${state ? "locked" : "unlocked"}.`)
            .setColor(state ? Colors.Red : Colors.Green),
        ],
        flags: MessageFlags.Ephemeral,
      })
    } catch (error: unknown) {
      let errorMessage = "Failed to update queue lock state."
      if (error instanceof Error && error.message === "Queue not found") {
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
