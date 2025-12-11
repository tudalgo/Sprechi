import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { AdminHelp } from "@commands/admin/help"
import { CommandInteraction } from "discord.js"
import { mockDeep } from "vitest-mock-extended"

describe("AdminHelp", () => {
  let command: AdminHelp
  let mockInteraction: any

  beforeEach(() => {
    command = new AdminHelp()
    mockInteraction = mockDeep<CommandInteraction>()
    mockInteraction.guild = { id: "guild123" }
    mockInteraction.user = { username: "testadmin", id: "admin123" }
    mockInteraction.reply = vi.fn()
  })

  it("should display admin help information", async () => {
    await command.help(mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalled()
    const call = mockInteraction.reply.mock.calls[0][0]
    expect(call.embeds).toBeDefined()
    expect(call.embeds[0].data.title).toBe("⚙️ Admin Help - Server Setup Guide")
    expect(call.embeds[0].data.fields).toBeDefined()
    expect(call.embeds[0].data.fields.length).toBe(6)
    expect(call.flags).toBeUndefined()
  })

  it("should contain role configuration commands", async () => {
    await command.help(mockInteraction)

    const call = mockInteraction.reply.mock.calls[0][0]
    const fields = call.embeds[0].data.fields

    const roleField = fields.find((f: any) => f.name === "1️⃣ Configure Roles")
    expect(roleField).toBeDefined()
    expect(roleField.value).toContain("/admin role set")
    expect(roleField.value).toContain("admin")
    expect(roleField.value).toContain("tutor")
    expect(roleField.value).toContain("verified")
  })

  it("should contain queue creation commands", async () => {
    await command.help(mockInteraction)

    const call = mockInteraction.reply.mock.calls[0][0]
    const fields = call.embeds[0].data.fields

    const queueField = fields.find((f: any) => f.name === "2️⃣ Create Queues")
    expect(queueField).toBeDefined()
    expect(queueField.value).toContain("/admin queue create")
  })

  it("should contain queue configuration commands", async () => {
    await command.help(mockInteraction)

    const call = mockInteraction.reply.mock.calls[0][0]
    const fields = call.embeds[0].data.fields

    const configField = fields.find((f: any) => f.name === "3️⃣ Configure Queue Settings")
    expect(configField).toBeDefined()
    expect(configField.value).toContain("/admin queue waiting-room")
    expect(configField.value).toContain("/admin queue log-channel-public")
    expect(configField.value).toContain("/admin queue log-channel-private")
  })

  it("should contain schedule and auto-lock commands", async () => {
    await command.help(mockInteraction)

    const call = mockInteraction.reply.mock.calls[0][0]
    const fields = call.embeds[0].data.fields

    const scheduleField = fields.find((f: any) => f.name === "4️⃣ Schedule & Auto-Lock")
    expect(scheduleField).toBeDefined()
    expect(scheduleField.value).toContain("/admin queue schedule add")
    expect(scheduleField.value).toContain("/admin queue auto-lock")
    expect(scheduleField.value).toContain("/admin queue schedule shift")
  })

  it("should contain statistics commands", async () => {
    await command.help(mockInteraction)

    const call = mockInteraction.reply.mock.calls[0][0]
    const fields = call.embeds[0].data.fields

    const statsField = fields.find((f: any) => f.name === "5️⃣ View Statistics")
    expect(statsField).toBeDefined()
    expect(statsField.value).toContain("/admin stats server")
    expect(statsField.value).toContain("/admin stats sessions")
  })

  it("should contain other useful commands", async () => {
    await command.help(mockInteraction)

    const call = mockInteraction.reply.mock.calls[0][0]
    const fields = call.embeds[0].data.fields

    const otherField = fields.find((f: any) => f.name === "📋 Other Useful Commands")
    expect(otherField).toBeDefined()
    expect(otherField.value).toContain("/admin queue list")
    expect(otherField.value).toContain("List members in a specific queue")
    expect(otherField.value).toContain("/admin queue lock")
    expect(otherField.value).toContain("/admin queue unlock")
    expect(otherField.value).toContain("/admin role summary")
    expect(otherField.value).toContain("/admin botinfo")
  })

  it("should have helpful footer text", async () => {
    await command.help(mockInteraction)

    const call = mockInteraction.reply.mock.calls[0][0]
    expect(call.embeds[0].data.footer).toBeDefined()
    expect(call.embeds[0].data.footer.text).toContain("roles")
  })

  it("should use proper ordering for setup steps", async () => {
    await command.help(mockInteraction)

    const call = mockInteraction.reply.mock.calls[0][0]
    const fields = call.embeds[0].data.fields

    // Verify the order is: roles -> create -> configure -> schedule -> stats
    expect(fields[0].name).toContain("Configure Roles")
    expect(fields[1].name).toContain("Create Queues")
    expect(fields[2].name).toContain("Configure Queue Settings")
    expect(fields[3].name).toContain("Schedule")
    expect(fields[4].name).toContain("Statistics")
  })
})
