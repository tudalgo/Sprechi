import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { QueueHelp } from "@commands/queue/help"
import { CommandInteraction, MessageFlags } from "discord.js"
import { mockDeep } from "vitest-mock-extended"
import { QueueManager } from "@managers/QueueManager"

describe("QueueHelp", () => {
  let command: QueueHelp
  let mockInteraction: any
  let mockQueueManager: any

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>()
    command = new QueueHelp(mockQueueManager)
    mockInteraction = mockDeep<CommandInteraction>()
    mockInteraction.guild = { id: "guild123", channels: { fetch: vi.fn() } }
    mockInteraction.user = { username: "testuser", id: "user123" }
    mockInteraction.reply = vi.fn()
  })

  it("should display help information without waiting room", async () => {
    // Mock queue without waiting room
    mockQueueManager.resolveQueue.mockRejectedValue(new Error("No queue"))

    await command.help(undefined, mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalled()
    const call = mockInteraction.reply.mock.calls[0][0]
    expect(call.embeds).toBeDefined()
    expect(call.embeds[0].data.title).toBe("📚 Queue Help - Student Commands")
    expect(call.embeds[0].data.fields).toBeDefined()
    expect(call.embeds[0].data.fields.length).toBe(4) // No waiting room field
    expect(call.flags).toBe(MessageFlags.Ephemeral)
  })

  it("should display help information with waiting room when configured", async () => {
    // Mock queue with waiting room
    const mockQueue = {
      id: "queue123",
      name: "test-queue",
      waitingRoomId: "channel123",
    }
    mockQueueManager.resolveQueue.mockResolvedValue(mockQueue)

    const mockChannel = {
      id: "channel123",
      name: "Waiting Room",
    }
    mockInteraction.guild.channels.fetch.mockResolvedValue(mockChannel)

    await command.help(undefined, mockInteraction)

    expect(mockQueueManager.resolveQueue).toHaveBeenCalledWith("guild123", undefined)
    expect(mockInteraction.guild.channels.fetch).toHaveBeenCalledWith("channel123")
    expect(mockInteraction.reply).toHaveBeenCalled()
    const call = mockInteraction.reply.mock.calls[0][0]
    expect(call.embeds[0].data.fields.length).toBe(5) // Includes waiting room field

    const waitingRoomField = call.embeds[0].data.fields.find((f: any) => f.name === "🎤 Waiting Room")
    expect(waitingRoomField).toBeDefined()
    expect(waitingRoomField.value).toContain("channel123")
  })

  it("should handle specific queue name parameter", async () => {
    const mockQueue = {
      id: "queue123",
      name: "specific-queue",
      waitingRoomId: "channel456",
    }
    mockQueueManager.resolveQueue.mockResolvedValue(mockQueue)

    const mockChannel = {
      id: "channel456",
      name: "Specific Waiting Room",
    }
    mockInteraction.guild.channels.fetch.mockResolvedValue(mockChannel)

    await command.help("specific-queue", mockInteraction)

    expect(mockQueueManager.resolveQueue).toHaveBeenCalledWith("guild123", "specific-queue")
    expect(mockInteraction.guild.channels.fetch).toHaveBeenCalledWith("channel456")
  })

  it("should handle missing guild", async () => {
    mockInteraction.guild = null

    await command.help(undefined, mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: "This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    })
  })

  it("should handle waiting room channel fetch failure gracefully", async () => {
    const mockQueue = {
      id: "queue123",
      name: "test-queue",
      waitingRoomId: "channel123",
    }
    mockQueueManager.resolveQueue.mockResolvedValue(mockQueue)
    mockInteraction.guild.channels.fetch.mockResolvedValue(null)

    await command.help(undefined, mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalled()
    const call = mockInteraction.reply.mock.calls[0][0]
    // Should not include waiting room field if channel fetch fails
    expect(call.embeds[0].data.fields.length).toBe(4)
  })

  it("should contain all expected commands in help", async () => {
    mockQueueManager.resolveQueue.mockRejectedValue(new Error("No queue"))

    await command.help(undefined, mockInteraction)

    const call = mockInteraction.reply.mock.calls[0][0]
    const fields = call.embeds[0].data.fields

    expect(fields.some((f: any) => f.value.includes("/queue join"))).toBe(true)
    expect(fields.some((f: any) => f.value.includes("/queue leave"))).toBe(true)
    expect(fields.some((f: any) => f.value.includes("/queue list"))).toBe(true)
    expect(fields.some((f: any) => f.value.includes("/queue summary"))).toBe(true)
  })
})
