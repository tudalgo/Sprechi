import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { QueueList } from "@commands/queue/list"
import { QueueManager } from "@managers/QueueManager"
import { CommandInteraction, MessageFlags, Colors } from "discord.js"
import { mockDeep } from "vitest-mock-extended"

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

describe("QueueList", () => {
  let queueList: QueueList
  let mockQueueManager: any
  let mockInteraction: any

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>();
    (QueueManager as any).mockImplementation(function () {
      return mockQueueManager
    })

    queueList = new QueueList(mockQueueManager)

    mockInteraction = mockDeep<CommandInteraction>()
    mockInteraction.user = { tag: "testuser", id: "user-123" }
    mockInteraction.guild = { id: "guild-123", name: "Test Guild" }
    mockInteraction.reply = vi.fn()
  })

  it("should list queues successfully", async () => {
    const mockQueues = [
      { name: "queue1", description: "desc1", isLocked: false, memberCount: 5 },
      { name: "queue2", description: "desc2", isLocked: true, memberCount: 2 },
    ]

    mockQueueManager.listQueues.mockResolvedValue(mockQueues)

    await queueList.list(mockInteraction)

    expect(mockQueueManager.listQueues).toHaveBeenCalledWith("guild-123")
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Available Queues",
            description: expect.stringContaining("**queue1** \ndesc1\nMembers: 5"),
            color: Colors.Blue,
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }))
  })

  it("should handle no queues found", async () => {
    mockQueueManager.listQueues.mockResolvedValue([])

    await queueList.list(mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: "No Queues Found",
            description: "There are no queues in this server.",
            color: Colors.Yellow,
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }))
  })

  it("should not allow command outside of guild", async () => {
    mockInteraction.guild = null

    await queueList.list(mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: "This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    })
  })

  it("should handle listQueues rejection", async () => {
    mockQueueManager.listQueues.mockRejectedValue(new Error("Database error"))

    await expect(queueList.list(mockInteraction)).rejects.toThrow("Database error")
    expect(mockQueueManager.listQueues).toHaveBeenCalledWith("guild-123")
  })
})
