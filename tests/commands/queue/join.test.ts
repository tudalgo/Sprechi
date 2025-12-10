import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { QueueJoin } from "@commands/queue/join"
import { QueueManager } from "@managers/QueueManager"
import { CommandInteraction, MessageFlags, Colors } from "discord.js"
import { mockDeep } from "vitest-mock-extended"
import { QueueNotFoundError, QueueLockedError, AlreadyInQueueError, TutorCannotJoinQueueError } from "@errors/QueueErrors"

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

describe("QueueJoin", () => {
  let queueJoin: QueueJoin
  let mockQueueManager: any
  let mockInteraction: any

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>();
    (QueueManager as any).mockImplementation(function () {
      return mockQueueManager
    })

    queueJoin = new QueueJoin(mockQueueManager)

    mockInteraction = mockDeep<CommandInteraction>()
    mockInteraction.user = { tag: "testuser", id: "user-123" }
    mockInteraction.guild = { id: "guild-123", name: "Test Guild" }
    mockInteraction.reply = vi.fn()
  })

  it("should join a queue successfully", async () => {
    const queueName = "test-queue"
    const mockQueue = { name: queueName }

    mockQueueManager.resolveQueue.mockResolvedValue(mockQueue)
    mockQueueManager.joinQueue.mockResolvedValue(undefined)

    await queueJoin.join(queueName, mockInteraction)

    expect(mockQueueManager.resolveQueue).toHaveBeenCalledWith("guild-123", queueName)
    expect(mockQueueManager.joinQueue).toHaveBeenCalledWith("guild-123", queueName, "user-123")
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Joined Queue",
            description: `You have joined the queue **${queueName}**.`,
            color: Colors.Green,
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }))
  })

  it("should handle queue not found error", async () => {
    const queueName = "non-existent-queue"

    mockQueueManager.resolveQueue.mockRejectedValue(new QueueNotFoundError(queueName))

    await queueJoin.join(queueName, mockInteraction)

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

  it("should handle queue locked error", async () => {
    const queueName = "locked-queue"

    mockQueueManager.resolveQueue.mockResolvedValue({ name: queueName })
    mockQueueManager.joinQueue.mockRejectedValue(new QueueLockedError(queueName))

    await queueJoin.join(queueName, mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Error",
            description: `Queue **${queueName}** is locked.`,
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }))
  })

  it("should handle already in queue error", async () => {
    const queueName = "test-queue"

    mockQueueManager.resolveQueue.mockResolvedValue({ name: queueName })
    mockQueueManager.joinQueue.mockRejectedValue(new AlreadyInQueueError(queueName))

    await queueJoin.join(queueName, mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Error",
            description: `You are already in queue **${queueName}**.`,
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }))
  })

  it("should handle tutor with active session trying to join queue", async () => {
    const queueName = "test-queue"

    mockQueueManager.resolveQueue.mockResolvedValue({ name: queueName })
    mockQueueManager.joinQueue.mockRejectedValue(new TutorCannotJoinQueueError())

    await queueJoin.join(queueName, mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Error",
            description: "You cannot join a queue while you have an active tutor session.",
          }),
        }),
      ]),
      flags: MessageFlags.Ephemeral,
    }))
  })

  it("should not allow command outside of guild", async () => {
    mockInteraction.guild = null

    await queueJoin.join("name", mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalledWith({
      content: "This command can only be used in a server.",
      flags: MessageFlags.Ephemeral,
    })
  })

  it("should auto-resolve single queue when name not provided", async () => {
    const queueName = "single-queue"
    const mockQueue = { name: queueName }

    mockQueueManager.resolveQueue.mockResolvedValue(mockQueue)
    mockQueueManager.joinQueue.mockResolvedValue(undefined)

    await queueJoin.join(undefined, mockInteraction)

    expect(mockQueueManager.resolveQueue).toHaveBeenCalledWith("guild-123", undefined)
    expect(mockQueueManager.joinQueue).toHaveBeenCalledWith("guild-123", queueName, "user-123")
  })

  it("should handle generic QueueError", async () => {
    const queueName = "test-queue"
    const { QueueError } = await import("@errors/QueueErrors")

    mockQueueManager.resolveQueue.mockResolvedValue({ name: queueName })
    mockQueueManager.joinQueue.mockRejectedValue(new QueueError("Generic queue error"))

    await queueJoin.join(queueName, mockInteraction)

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
