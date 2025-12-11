import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { AdminQueueList } from "@/commands/admin/queue/list"
import { QueueManager } from "@managers/QueueManager"
import { mockDeep } from "vitest-mock-extended"
import { CommandInteraction, MessageFlags, EmbedBuilder } from "discord.js"

// Mock QueueManager
vi.mock("@managers/QueueManager")
// Mock logger
vi.mock("@utils/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe("AdminQueueList", () => {
  let command: AdminQueueList
  let mockQueueManager: any
  let mockInteraction: any

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>()
    command = new AdminQueueList(mockQueueManager)

    // Setup mock interaction
    mockInteraction = {
      guild: { id: "guild-123" },
      user: { username: "admin" },
      reply: vi.fn(),
    }
  })

  it("should list queue members successfully", async () => {
    const mockEmbed = new EmbedBuilder().setTitle("Queue List")
    mockQueueManager.getQueueListEmbed.mockResolvedValue(mockEmbed)

    await command.list("test-queue", 10, mockInteraction as unknown as CommandInteraction)

    expect(mockQueueManager.getQueueListEmbed).toHaveBeenCalledWith("guild-123", "test-queue", 10)
    expect(mockInteraction.reply).toHaveBeenCalled()
  })

  it("should handle errors gracefully", async () => {
    mockQueueManager.getQueueListEmbed.mockRejectedValue(new Error("Queue not found"))

    await command.list("test-queue", 5, mockInteraction as unknown as CommandInteraction)

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      embeds: [expect.any(EmbedBuilder)],
      flags: MessageFlags.Ephemeral,
    })
    const callArgs = mockInteraction.reply.mock.calls[0][0]
    expect(callArgs.embeds[0].data.description).toContain("Queue not found")
    expect(callArgs.embeds[0].data.title).toBe("Error")
  })
})
