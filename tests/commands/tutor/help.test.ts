import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { TutorHelp } from "@commands/tutor/help"
import { CommandInteraction, MessageFlags } from "discord.js"
import { mockDeep } from "vitest-mock-extended"

describe("TutorHelp", () => {
  let command: TutorHelp
  let mockInteraction: any

  beforeEach(() => {
    command = new TutorHelp()
    mockInteraction = mockDeep<CommandInteraction>()
    mockInteraction.guild = { id: "guild123" }
    mockInteraction.user = { username: "testtutor", id: "tutor123" }
    mockInteraction.reply = vi.fn()
  })

  it("should display tutor help information", async () => {
    await command.help(mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalled()
    const call = mockInteraction.reply.mock.calls[0][0]
    expect(call.embeds).toBeDefined()
    expect(call.embeds[0].data.title).toBe("🎓 Tutor Help - Tutor Commands")
    expect(call.embeds[0].data.fields).toBeDefined()
    expect(call.embeds[0].data.fields.length).toBe(7)
    expect(call.flags).toBe(MessageFlags.Ephemeral)
  })

  it("should contain session management commands", async () => {
    await command.help(mockInteraction)

    const call = mockInteraction.reply.mock.calls[0][0]
    const fields = call.embeds[0].data.fields

    expect(fields.some((f: any) => f.value.includes("/tutor session start"))).toBe(true)
    expect(fields.some((f: any) => f.value.includes("/tutor session end"))).toBe(true)
  })

  it("should contain queue management commands", async () => {
    await command.help(mockInteraction)

    const call = mockInteraction.reply.mock.calls[0][0]
    const fields = call.embeds[0].data.fields

    expect(fields.some((f: any) => f.value.includes("/tutor queue next"))).toBe(true)
    expect(fields.some((f: any) => f.value.includes("/tutor queue pick"))).toBe(true)
    expect(fields.some((f: any) => f.value.includes("/tutor queue list"))).toBe(true)

    // Verify it correctly describes listing queue members, not all queues
    const listField = fields.find((f: any) => f.value.includes("/tutor queue list"))
    expect(listField.value).toContain("members")
  })

  it("should contain voice channel management commands", async () => {
    await command.help(mockInteraction)

    const call = mockInteraction.reply.mock.calls[0][0]
    const fields = call.embeds[0].data.fields

    const voiceField = fields.find((f: any) => f.name === "🎤 Voice Channel Management")
    expect(voiceField).toBeDefined()
    expect(voiceField.value).toContain("/tutor voice close")
    expect(voiceField.value).toContain("/tutor voice kick")
    expect(voiceField.value).toContain("/tutor voice permit")
  })

  it("should contain summary command", async () => {
    await command.help(mockInteraction)

    const call = mockInteraction.reply.mock.calls[0][0]
    const fields = call.embeds[0].data.fields

    expect(fields.some((f: any) => f.value.includes("/tutor summary"))).toBe(true)
  })

  it("should handle missing guild", async () => {
    mockInteraction.guild = null

    await command.help(mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: "This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    })
  })

  it("should have helpful footer text", async () => {
    await command.help(mockInteraction)

    const call = mockInteraction.reply.mock.calls[0][0]
    expect(call.embeds[0].data.footer).toBeDefined()
    expect(call.embeds[0].data.footer.text).toContain("session start")
  })
})
