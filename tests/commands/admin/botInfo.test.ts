import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { AdminBotInfo } from "@commands/admin/botinfo"
import { CommandInteraction, Client, MessageFlags } from "discord.js"
import { mockDeep } from "vitest-mock-extended"

describe("AdminBotInfo", () => {
  let command: AdminBotInfo
  let mockInteraction: any

  beforeEach(() => {
    command = new AdminBotInfo()
    mockInteraction = mockDeep<CommandInteraction>()

    // Mock client.guilds.cache.size
    const mockClient = mockDeep<Client>()
    Object.defineProperty(mockClient, "guilds", {
      value: {
        cache: {
          size: 5,
        },
      },
    })
    mockInteraction.client = mockClient
    mockInteraction.reply = vi.fn()
  })

  it("should display bot info", async () => {
    await command.botinfo(mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalled()
    const call = mockInteraction.reply.mock.calls[0][0]
    const fields = call.embeds[0].data.fields

    expect(fields).toBeDefined()
    expect(fields.some((f: any) => f.name === "Uptime")).toBe(true)
    expect(fields.some((f: any) => f.name === "Memory Usage")).toBe(true)
    expect(fields.some((f: any) => f.name === "Guilds" && f.value === "5")).toBe(true)
    expect(fields.some((f: any) => f.name === "Version")).toBe(true)
    expect(call.flags).toBe(MessageFlags.Ephemeral)
  })

  it("should handle reply failure", async () => {
    mockInteraction.reply.mockRejectedValue(new Error("Reply failed"))

    await expect(command.botinfo(mockInteraction)).rejects.toThrow("Reply failed")
  })

  it("should handle missing client stats gracefully", async () => {
    const mockClient = mockDeep<Client>()
    Object.defineProperty(mockClient, "guilds", {
      value: {
        cache: {
          size: 0,
        },
      },
    })
    mockInteraction.client = mockClient

    await command.botinfo(mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalled()
    const call = mockInteraction.reply.mock.calls[0][0]
    const guildsField = call.embeds[0].data.fields.find((f: any) => f.name === "Guilds")
    expect(guildsField.value).toBe("0")
  })
})
