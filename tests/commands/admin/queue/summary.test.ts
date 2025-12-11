import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { AdminQueueSummary } from "@/commands/admin/queue/summary"
import { QueueManager } from "@managers/QueueManager"
import { mockDeep } from "vitest-mock-extended"
import { CommandInteraction, EmbedBuilder } from "discord.js"

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

describe("AdminQueueSummary", () => {
  let command: AdminQueueSummary
  let mockQueueManager: any
  let mockInteraction: any

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>()
    command = new AdminQueueSummary(mockQueueManager)

    // Setup mock interaction
    mockInteraction = {
      guild: { id: "guild-123" },
      user: { username: "admin" },
      reply: vi.fn(),
    }
  })

  it("should show queue summary successfully", async () => {
    const mockEmbed = new EmbedBuilder().setTitle("Queue Summary")
    mockQueueManager.getQueueSummaryEmbed.mockResolvedValue(mockEmbed)

    await command.summary("test-queue", mockInteraction as unknown as CommandInteraction)

    expect(mockQueueManager.getQueueSummaryEmbed).toHaveBeenCalledWith("guild-123", "test-queue")
    expect(mockInteraction.reply).toHaveBeenCalled()
  })

  it("should handle errors gracefully", async () => {
    mockQueueManager.getQueueSummaryEmbed.mockRejectedValue(new Error("Queue not found"))

    await command.summary("test-queue", mockInteraction as unknown as CommandInteraction)

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      embeds: [expect.any(EmbedBuilder)],
    })
    const callArgs = mockInteraction.reply.mock.calls[0][0]
    expect(callArgs.embeds[0].data.description).toContain("Queue not found")
    expect(callArgs.embeds[0].data.title).toBe("Error")
  })
})
