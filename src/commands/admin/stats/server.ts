import { ApplicationCommandOptionType, AttachmentBuilder, CommandInteraction, EmbedBuilder } from "discord.js"
import { Discord, Slash, SlashGroup, SlashOption } from "discordx"
import { injectable } from "tsyringe"
import { createCanvas } from "@napi-rs/canvas"
import { Chart, registerables, ChartItem } from "chart.js"
import db from "@db"

Chart.register(...registerables)
import { adminStatsCommands } from "@config/messages"

@Discord()
@injectable()
@SlashGroup({ name: "stats", description: "Admin statistics commands", root: "admin" })
@SlashGroup("stats", "admin")
export class AdminStatsServer {
  @Slash({ name: "server", description: "Shows general server information and activity graphs", dmPermission: false })
  async server(
    @SlashOption({
      name: "show-empty-days",
      description: adminStatsCommands.server.optionShowEmptyDays,
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    })
    showEmptyDays: boolean | undefined,
    interaction: CommandInteraction,
  ): Promise<void> {
    if (!interaction.guild) return

    await interaction.deferReply()

    const guild = interaction.guild
    await guild.roles.fetch()
    const members = await guild.members.fetch()

    const width = 800 // px
    const height = 600 // px

    // Member Joins
    const memberData = [...members.values()]
      .filter(x => x.joinedAt != null)
      .sort((x, y) => (x.joinedAt!).getTime() - (y.joinedAt!).getTime())

    const days: { x: number, y: number, z: number }[] = []

    if (memberData.length > 0 && showEmptyDays) {
      const firstDay = new Date(memberData[0].joinedAt!)
      const lastDay = new Date()
      firstDay.setHours(0, 0, 0, 0)
      lastDay.setHours(0, 0, 0, 0)
      for (let i = firstDay.getTime(); i <= lastDay.getTime(); i += 86400000) {
        days.push({ x: i, y: 0, z: 0 })
      }
    }

    for (const m of memberData) {
      const roundedDate = new Date(m.joinedAt!)
      roundedDate.setHours(0, 0, 0, 0)
      const roundedDateString = roundedDate.getTime()

      let day = days.find(x => x.x === roundedDateString)
      if (!day) {
        day = { x: roundedDateString, y: 0, z: 0 }
        days.push(day)
      }
      day.y++
    }

    // Verifications (from DB) - filter by current guild
    const verifiedUsers = await db.query.users.findMany({
      where: (table, { eq, and, isNotNull }) => and(
        eq(table.guildId, guild.id),
        isNotNull(table.verifiedAt),
      ),
      columns: {
        verifiedAt: true,
      },
    })

    // Count of verified members from database (source of truth)
    const verifiedMemberCount = verifiedUsers.length

    for (const user of verifiedUsers) {
      if (!user.verifiedAt) continue
      const roundedDate = new Date(user.verifiedAt)
      roundedDate.setHours(0, 0, 0, 0)
      const roundedDateString = roundedDate.getTime()

      let day = days.find(x => x.x === roundedDateString)
      if (!day) {
        // If showEmptyDays is false, we might need to add it.
        // If showEmptyDays is true, it should have been added unless it's outside range (unlikely if users are in guild, but possible if they left)
        // However, we are tracking verifications.
        day = { x: roundedDateString, y: 0, z: 0 }
        days.push(day)
      }
      day.z++
    }

    // Sort days if we added new ones
    days.sort((a, b) => a.x - b.x)

    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext("2d")

    const chart = new Chart(ctx as unknown as ChartItem, {
      type: "line",
      data: {
        labels: days.map((x) => {
          const date = new Date(x.x)
          // Simple date formatting
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
        }),
        datasets: [
          {
            label: adminStatsCommands.server.datasets.memberJoinCount,
            data: days.map(d => d.y),
            fill: true,
            borderColor: "rgba(0, 162, 255, 1)",
            backgroundColor: "rgba(0, 162, 255, 0.5)",
            tension: 0.1,
          },
          {
            label: adminStatsCommands.server.datasets.memberVerifyCount,
            data: days.map(d => d.z),
            fill: true,
            borderColor: "rgba(162, 162, 162, 1)",
            backgroundColor: "rgba(162, 162, 162, 0.5)",
            tension: 0.1,
          },
        ],
      },
      options: {
        animation: false,
        responsive: false,
        plugins: {
          legend: {
            labels: {
              color: "#ffffff",
              font: {
                size: 12,
              },
            },
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: "Date",
              color: "#ffffff",
              font: {
                size: 14,
              },
            },
            grid: {
              color: "#ffffff",
            },
            ticks: {
              color: "#ffffff",
              font: {
                size: 12,
              },
            },
          },
          y: {
            title: {
              display: true,
              text: "Count",
              color: "#ffffff",
              font: {
                size: 14,
              },
            },
            grid: {
              color: "#ffffff",
            },
            ticks: {
              color: "#ffffff",
              font: {
                size: 12,
              },
            },
            min: 0,
          },
        },
      },
    })

    const buffer = await canvas.encode("png")
    chart.destroy()

    const attachment = new AttachmentBuilder(buffer, { name: "graph.png" })

    const embed = new EmbedBuilder()
      .setTitle(adminStatsCommands.server.embed.title)
      .setDescription(adminStatsCommands.server.embed.description)
      .addFields([
        { name: adminStatsCommands.server.embed.fields.members, value: `${guild.memberCount}`, inline: true },
        { name: adminStatsCommands.server.embed.fields.verifiedMembers, value: `${verifiedMemberCount}`, inline: true },
        { name: adminStatsCommands.server.embed.fields.unverifiedMembers, value: `${guild.memberCount - verifiedMemberCount}`, inline: true },
        { name: adminStatsCommands.server.embed.fields.channels, value: `${guild.channels.cache.size}`, inline: true },
        { name: adminStatsCommands.server.embed.fields.owner, value: `<@${guild.ownerId}>`, inline: true },
        { name: adminStatsCommands.server.embed.fields.createdAt, value: `<t:${Math.round(guild.createdAt.getTime() / 1000)}:f>`, inline: true },
      ])
      .setImage("attachment://graph.png")
      .setColor("#0099ff")

    await interaction.editReply({
      embeds: [embed],
      files: [attachment],
    })
  }
}
