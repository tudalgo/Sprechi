import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { QueueLeave } from "@commands/queue/leave"
import { QueueManager } from "@managers/QueueManager"
import { CommandInteraction, MessageFlags, Colors } from "discord.js"
import { mockDeep } from "vitest-mock-extended"
import { QueueNotFoundError, NotInQueueError } from "@errors/QueueErrors"

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

describe("QueueLeave", () => {
  let queueLeave: QueueLeave
  let mockQueueManager: any
  let mockInteraction: any

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>();
    (QueueManager as any).mockImplementation(function () {
      return mockQueueManager
    })

    queueLeave = new QueueLeave(mockQueueManager)

    mockInteraction = mockDeep<CommandInteraction>()
    mockInteraction.user = { tag: "testuser", id: "user-123" }
    mockInteraction.guild = { id: "guild-123", name: "Test Guild" }
    mockInteraction.reply = vi.fn()
  })

  it("should leave a queue successfully when name is provided", async () => {
    const queueName = "test-queue"

    mockQueueManager.leaveQueue.mockResolvedValue(undefined)

    await queueLeave.leave(queueName, mockInteraction)

    expect(mockQueueManager.leaveQueue).toHaveBeenCalledWith("guild-123", queueName, "user-123")
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Left Queue",
            description: expect.stringContaining(`You have left the queue **${queueName}**`),
            color: Colors.Yellow,
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }))
  })

  it("should auto-detect queue when name is not provided", async () => {
    const queueName = "auto-queue"

    mockQueueManager.getQueueByUser.mockResolvedValue({ name: queueName })
    mockQueueManager.leaveQueue.mockResolvedValue(undefined)

    await queueLeave.leave(undefined, mockInteraction)

    expect(mockQueueManager.getQueueByUser).toHaveBeenCalledWith("guild-123", "user-123")
    expect(mockQueueManager.leaveQueue).toHaveBeenCalledWith("guild-123", queueName, "user-123")
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Left Queue",
            description: expect.stringContaining(`You have left the queue **${queueName}**`),
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }))
  })

  it("should resolve default queue if not in any queue and name not provided", async () => {
    const queueName = "default-queue"

    mockQueueManager.getQueueByUser.mockResolvedValue(null)
    mockQueueManager.resolveQueue.mockResolvedValue({ name: queueName })
    mockQueueManager.leaveQueue.mockResolvedValue(undefined)

    await queueLeave.leave(undefined, mockInteraction)

    expect(mockQueueManager.getQueueByUser).toHaveBeenCalledWith("guild-123", "user-123")
    expect(mockQueueManager.resolveQueue).toHaveBeenCalledWith("guild-123")
    expect(mockQueueManager.leaveQueue).toHaveBeenCalledWith("guild-123", queueName, "user-123")
  })

  it("should handle queue not found error", async () => {
    const queueName = "non-existent-queue"

    mockQueueManager.leaveQueue.mockRejectedValue(new QueueNotFoundError(queueName))

    await queueLeave.leave(queueName, mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Error",
            description: `Queue **${queueName}** not found.`,
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }))
  })

  it("should handle not in queue error", async () => {
    const queueName = "test-queue"

    mockQueueManager.leaveQueue.mockRejectedValue(new NotInQueueError(queueName))

    await queueLeave.leave(queueName, mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Error",
            description: `You are not in queue **${queueName}**.`,
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }))
  })

  it("should not allow command outside of guild", async () => {
    mockInteraction.guild = null

    await queueLeave.leave("name", mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: "This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    })
  })

  it("should handle getQueueByUser rejection", async () => {
    mockQueueManager.getQueueByUser.mockRejectedValue(new Error("Database error"))

    await queueLeave.leave(undefined, mockInteraction)

    expect(mockQueueManager.getQueueByUser).toHaveBeenCalledWith("guild-123", "user-123")
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Error",
            description: "Failed to leave queue.",
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }))
  })

  it("should handle leaveQueue throwing generic QueueError", async () => {
    const queueName = "test-queue"
    const { QueueError } = await import("@errors/QueueErrors")

    mockQueueManager.leaveQueue.mockRejectedValue(new QueueError("Generic queue error"))

    await queueLeave.leave(queueName, mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Error",
            description: "Generic queue error",
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }))
  })
})
