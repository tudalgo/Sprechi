import { CommandInteraction, EmbedBuilder, MessageFlags, Colors, version as djsVersion } from "discord.js"
import { Discord, Slash, SlashGroup } from "discordx"
import { injectable } from "tsyringe"

@Discord()
@injectable()
@SlashGroup({ name: "admin", description: "Admin commands" })
export class AdminBotInfo {

  @Slash({ name: "botinfo", description: "Display bot information" })
  @SlashGroup("admin")
  async botinfo(interaction: CommandInteraction): Promise<void> {
    const memory = process.memoryUsage()
    const uptime = process.uptime()

    const days = Math.floor(uptime / 86400)
    const hours = Math.floor(uptime / 3600) % 24
    const minutes = Math.floor(uptime / 60) % 60
    const seconds = Math.floor(uptime % 60)

    const embed = new EmbedBuilder()
      .setTitle("Bot Information")
      .setThumbnail(interaction.client.user?.displayAvatarURL() ?? null)
      .addFields(
        { name: "Uptime", value: `${days}d ${hours}h ${minutes}m ${seconds}s`, inline: true },
        { name: "Memory Usage", value: `${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`, inline: true },
        { name: "Guilds", value: `${interaction.client.guilds.cache.size}`, inline: true },
        { name: "Version", value: process.env.npm_package_version ?? "1.0.0", inline: true },
        { name: "Discord.js", value: `v${djsVersion}`, inline: true },
        { name: "Node.js", value: process.version, inline: true }
      )
      .setColor(Colors.Blue)

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral })
  }
}
