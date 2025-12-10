import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { QueueSummaryCommand } from "@commands/queue/summary"
import { QueueManager } from "@managers/QueueManager"
import { CommandInteraction, User } from "discord.js"
import { mockDeep } from "vitest-mock-extended"

describe("QueueSummaryCommand", () => {
  let mockQueueManager: any
  let mockInteraction: any

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>()
    mockInteraction = mockDeep<CommandInteraction>()
    mockInteraction.guildId = "guild-123"
    mockInteraction.user = { id: "user-123" } as User
    mockInteraction.editReply = vi.fn()
    mockInteraction.deferReply = vi.fn()
  })

  it("should show queue summary", async () => {
    const command = new QueueSummaryCommand(mockQueueManager)
    const mockQueue = { id: "queue-123", name: "test-queue", description: "desc" }

    mockQueueManager.getQueueByUser.mockResolvedValue(mockQueue)
    mockQueueManager.getQueuePosition.mockResolvedValue(1)
    mockQueueManager.getQueueMembers.mockResolvedValue(["member1", "member2"])
    const joinedAt = new Date()
    mockQueueManager.getQueueMember.mockResolvedValue({ joinedAt })

    await command.summary(mockInteraction)

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Queue Summary: test-queue",
              fields: expect.arrayContaining([
                expect.objectContaining({ name: "Total Entries", value: "2" }),
                expect.objectContaining({ name: "Your Position", value: "1" }),
                expect.objectContaining({ name: "Joined", value: `<t:${Math.floor(joinedAt.getTime() / 1000)}:R>` }),
              ]),
            }),
          }),
        ]),
      }),
    )
  })

  it("should error if not in queue", async () => {
    const command = new QueueSummaryCommand(mockQueueManager)
    mockQueueManager.getQueueByUser.mockResolvedValue(null)

    await command.summary(mockInteraction)

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Not in Queue",
            }),
          }),
        ]),
      }),
    )
  })

  it("should handle errors", async () => {
    const command = new QueueSummaryCommand(mockQueueManager)
    mockQueueManager.getQueueByUser.mockRejectedValue(new Error("Database error"))

    await command.summary(mockInteraction)

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Error",
              description: "Database error",
            }),
          }),
        ]),
      }),
    )
  })

  it("should return early if not in a guild", async () => {
    const command = new QueueSummaryCommand(mockQueueManager)
    mockInteraction.guildId = null

    await command.summary(mockInteraction)

    expect(mockInteraction.deferReply).not.toHaveBeenCalled()
  })

  it("should handle getQueueMember returning null after getQueueByUser succeeds", async () => {
    const command = new QueueSummaryCommand(mockQueueManager)
    const mockQueue = { id: "queue-123", name: "test-queue", description: "desc" }

    mockQueueManager.getQueueByUser.mockResolvedValue(mockQueue)
    mockQueueManager.getQueuePosition.mockResolvedValue(1)
    mockQueueManager.getQueueMembers.mockResolvedValue(["member1"])
    mockQueueManager.getQueueMember.mockResolvedValue(null)

    await command.summary(mockInteraction)

    // When member is null, accessing member.joinedAt throws TypeError which gets caught
    expect(mockInteraction.editReply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            title: "Error",
          }),
        }),
      ]),
    }))
  })

  it("should call deferReply before editReply", async () => {
    const command = new QueueSummaryCommand(mockQueueManager)
    const mockQueue = { id: "queue-123", name: "test-queue", description: "desc" }
    const joinedAt = new Date()

    mockQueueManager.getQueueByUser.mockResolvedValue(mockQueue)
    mockQueueManager.getQueuePosition.mockResolvedValue(1)
    mockQueueManager.getQueueMembers.mockResolvedValue(["member1"])
    mockQueueManager.getQueueMember.mockResolvedValue({ joinedAt })

    await command.summary(mockInteraction)

    expect(mockInteraction.deferReply).toHaveBeenCalled()
    expect(mockInteraction.editReply).toHaveBeenCalled()
    // Ensure deferReply was called before editReply
    const deferOrder = mockInteraction.deferReply.mock.invocationCallOrder[0]
    const editOrder = mockInteraction.editReply.mock.invocationCallOrder[0]
    expect(deferOrder).toBeLessThan(editOrder)
  })
})
