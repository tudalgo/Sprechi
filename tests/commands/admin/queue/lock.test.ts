import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { AdminQueueLockCommand } from "@commands/admin/queue/lock"
import { QueueManager } from "@managers/QueueManager"
import { CommandInteraction } from "discord.js"
import { mockDeep } from "vitest-mock-extended"

describe("AdminQueueLockCommand", () => {
  let mockQueueManager: any
  let mockInteraction: any

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>()
    mockInteraction = mockDeep<CommandInteraction>()
    mockInteraction.guildId = "guild-123"
    mockInteraction.editReply = vi.fn()
    mockInteraction.deferReply = vi.fn()
  })

  it("should lock queue successfully", async () => {
    const command = new AdminQueueLockCommand(mockQueueManager)
    mockQueueManager.setQueueLockState.mockResolvedValue(undefined)

    await command.lock("test-queue", mockInteraction)

    expect(mockQueueManager.setScheduleEnabled).toHaveBeenCalledWith("guild-123", "test-queue", false)
    expect(mockQueueManager.setQueueLockState).toHaveBeenCalledWith("guild-123", "test-queue", true)
    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Queue Locked",
            }),
          }),
        ]),
      }),
    )
  })

  it("should throw an error if queue is already locked", async () => {
    const command = new AdminQueueLockCommand(mockQueueManager)
    mockQueueManager.setQueueLockState.mockRejectedValue(new Error("Queue is already locked"))

    await command.lock("test-queue", mockInteraction)

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Error",
              description: "Queue is already locked",
            }),
          }),
        ]),
      }),
    )
  })

  it("should throw an error if queue is not found", async () => {
    const command = new AdminQueueLockCommand(mockQueueManager)
    mockQueueManager.setQueueLockState.mockRejectedValue(new Error("Queue not found"))

    await command.lock("test-queue", mockInteraction)

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Error",
              description: "Queue not found",
            }),
          }),
        ]),
      }),
    )
  })

  it("should return early if not in a guild", async () => {
    const command = new AdminQueueLockCommand(mockQueueManager)
    mockInteraction.guildId = null

    await command.lock("test-queue", mockInteraction)

    expect(mockInteraction.deferReply).not.toHaveBeenCalled()
  })

  it("should handle setScheduleEnabled failure", async () => {
    const command = new AdminQueueLockCommand(mockQueueManager)
    mockQueueManager.setScheduleEnabled.mockRejectedValue(new Error("Database error"))

    await command.lock("test-queue", mockInteraction)

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
})
