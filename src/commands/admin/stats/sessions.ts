import { AttachmentBuilder, CommandInteraction, EmbedBuilder } from "discord.js"
import { Discord, Slash, SlashGroup } from "discordx"
import { injectable } from "tsyringe"
import { createCanvas } from "@napi-rs/canvas"
import { Chart, registerables, ChartItem } from "chart.js"
import db, { sessions, queues, sessionStudents } from "@db"
import { eq, sql, desc } from "drizzle-orm"

Chart.register(...registerables)
import { adminStatsCommands } from "@config/messages"

@Discord()
@injectable()
@SlashGroup("stats", "admin")
export class AdminStatsSessions {
  @Slash({ name: "sessions", description: adminStatsCommands.sessions.description, dmPermission: false })
  async sessions(
    interaction: CommandInteraction,
  ): Promise<void> {
    if (!interaction.guild) return

    await interaction.deferReply()

    const width = 800
    const height = 400

    // 1. Queue Popularity (Total Student Sessions per Queue)
    const studentsPerQueue = await db
      .select({
        queueName: queues.name,
        count: sql<number>`count(${sessionStudents.id})`.mapWith(Number),
      })
      .from(sessionStudents)
      .innerJoin(sessions, eq(sessionStudents.sessionId, sessions.id))
      .innerJoin(queues, eq(sessions.queueId, queues.id))
      .groupBy(queues.name)
      .orderBy(desc(sql`count(${sessionStudents.id})`))

    // 2. Activity by Hour of Day (Student occurrence count by day and hour)
    // Counts all student occurrences, not unique students, to reflect actual usage
    const activityByHour = await db
      .select({
        dow: sql<number>`extract(isodow from ${sessions.startTime})`.mapWith(Number), // 1 = Monday, 7 = Sunday
        hour: sql<number>`extract(hour from ${sessions.startTime})`.mapWith(Number),
        count: sql<number>`count(${sessionStudents.id})`.mapWith(Number),
      })
      .from(sessionStudents)
      .innerJoin(sessions, eq(sessionStudents.sessionId, sessions.id))
      .groupBy(sql`extract(isodow from ${sessions.startTime})`, sql`extract(hour from ${sessions.startTime})`)
      .orderBy(sql`extract(isodow from ${sessions.startTime})`, sql`extract(hour from ${sessions.startTime})`)

    // Process data for Chart.js
    const hours = Array.from({ length: 24 }, (_, i) => i)
    const days = [
      { label: "Monday", dow: 1, color: "rgba(255, 99, 132, 1)", bg: "rgba(255, 99, 132, 0.5)" },
      { label: "Tuesday", dow: 2, color: "rgba(54, 162, 235, 1)", bg: "rgba(54, 162, 235, 0.5)" },
      { label: "Wednesday", dow: 3, color: "rgba(255, 206, 86, 1)", bg: "rgba(255, 206, 86, 0.5)" },
      { label: "Thursday", dow: 4, color: "rgba(75, 192, 192, 1)", bg: "rgba(75, 192, 192, 0.5)" },
      { label: "Friday", dow: 5, color: "rgba(153, 102, 255, 1)", bg: "rgba(153, 102, 255, 0.5)" },
      { label: "Saturday", dow: 6, color: "rgba(255, 159, 64, 1)", bg: "rgba(255, 159, 64, 0.5)" },
      { label: "Sunday", dow: 7, color: "rgba(201, 203, 207, 1)", bg: "rgba(201, 203, 207, 0.5)" },
    ]

    const datasets = days.map((day) => {
      const data = hours.map((h) => {
        const found = activityByHour.find(x => x.dow === day.dow && x.hour === h)
        return found ? found.count : 0
      })
      return {
        label: day.label,
        data: data,
        borderColor: day.color,
        backgroundColor: day.bg,
        borderWidth: 1,
        hidden: false, // Show all by default
      }
    })

    // Generate Queue Popularity Chart
    const canvasPop = createCanvas(width, height)
    const ctxPop = canvasPop.getContext("2d")
    const chartPop = new Chart(ctxPop as unknown as ChartItem, {
      type: "bar",
      data: {
        labels: studentsPerQueue.map(x => x.queueName),
        datasets: [{
          label: adminStatsCommands.sessions.datasetLabel,
          data: studentsPerQueue.map(x => x.count),
          backgroundColor: "rgba(54, 162, 235, 0.7)",
          borderColor: "rgba(54, 162, 235, 1)",
          borderWidth: 1,
        }],
      },
      options: {
        animation: false,
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: adminStatsCommands.sessions.charts.queuePopularity,
          },
          legend: { display: false },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: "Queue Name",
            },
          },
          y: {
            title: {
              display: true,
              text: "Number of Students",
            },
            beginAtZero: true,
          },
        },
      },
    })

    const bufferPop = await canvasPop.encode("png")
    chartPop.destroy()

    // Generate Activity Chart
    const canvasAct = createCanvas(width, height)
    const ctxAct = canvasAct.getContext("2d")
    const chartAct = new Chart(ctxAct as unknown as ChartItem, {
      type: "line", // Line chart is better for comparing multiple days across hours
      data: {
        labels: hours.map(h => `${h}:00`),
        datasets: datasets,
      },
      options: {
        animation: false,
        responsive: false,
        plugins: {
          title: {
            display: true,
            text: adminStatsCommands.sessions.charts.studentActivity,
          },
          legend: {
            display: true,
            labels: {
              color: "#888888", // Gray color readable in both light and dark modes
            },
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: "Hour of Day",
            },
          },
          y: {
            title: {
              display: true,
              text: "Number of Students",
            },
            beginAtZero: true,
            ticks: {
              stepSize: 1,
            },
          },
        },
      },
    })

    const bufferAct = await canvasAct.encode("png")
    chartAct.destroy()

    const attachmentPop = new AttachmentBuilder(bufferPop, { name: "popularity.png" })
    const attachmentAct = new AttachmentBuilder(bufferAct, { name: "activity.png" })

    const totalStudents = studentsPerQueue.reduce((acc, curr) => acc + curr.count, 0)

    const embed = new EmbedBuilder()
      .setTitle(adminStatsCommands.sessions.embed.sessionStats.title)
      .setDescription(adminStatsCommands.sessions.embed.sessionStats.description(totalStudents))
      .setImage("attachment://popularity.png")
      .setColor("#0099ff")

    // Using two embeds for two images
    const embed2 = new EmbedBuilder()
      .setTitle(adminStatsCommands.sessions.embed.weeklyActivity.title)
      .setImage("attachment://activity.png")
      .setDescription(adminStatsCommands.sessions.embed.weeklyActivity.description)
      .setColor("#ff0000")

    await interaction.editReply({
      embeds: [embed, embed2],
      files: [attachmentPop, attachmentAct],
    })
  }
}
