import { CommandInteraction, EmbedBuilder, Colors, version as djsVersion } from "discord.js"
import { Discord, Slash, SlashGroup } from "discordx"
import { injectable } from "tsyringe"
import { adminCommands } from "@config/messages"

@Discord()
@injectable()
@SlashGroup("admin")
export class AdminBotInfo {
  @Slash({ name: "botinfo", description: adminCommands.botinfo.description, dmPermission: false })
  async botinfo(interaction: CommandInteraction): Promise<void> {
    const memory = process.memoryUsage()
    const uptime = process.uptime()

    const days = Math.floor(uptime / 86400)
    const hours = Math.floor(uptime / 3600) % 24
    const minutes = Math.floor(uptime / 60) % 60
    const seconds = Math.floor(uptime % 60)

    const embed = new EmbedBuilder()
      .setTitle(adminCommands.botinfo.embed.title)
      .setThumbnail(interaction.client.user?.displayAvatarURL() ?? null)
      .addFields(
        { name: adminCommands.botinfo.embed.fields.uptime, value: `${days}d ${hours}h ${minutes}m ${seconds}s`, inline: true },
        { name: adminCommands.botinfo.embed.fields.memoryUsage, value: `${(memory.heapUsed / 1024 / 1024).toFixed(2)} MB`, inline: true },
        { name: adminCommands.botinfo.embed.fields.guilds, value: `${interaction.client.guilds.cache.size}`, inline: true },
        { name: adminCommands.botinfo.embed.fields.version, value: process.env.npm_package_version ?? "1.0.0", inline: true },
        { name: adminCommands.botinfo.embed.fields.discordJs, value: `v${djsVersion}`, inline: true },
        { name: adminCommands.botinfo.embed.fields.nodeJs, value: process.version, inline: true },
      )
      .setColor(Colors.Blue)

    await interaction.reply({ embeds: [embed] })
  }
}
