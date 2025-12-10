import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { AdminQueueAutoLockCommand } from "@commands/admin/queue/auto_lock"
import { QueueManager } from "@managers/QueueManager"
import { CommandInteraction } from "discord.js"
import { mockDeep } from "vitest-mock-extended"
import { QueueNotFoundError } from "@errors/QueueErrors"

describe("AdminQueueAutoLockCommand", () => {
  let mockQueueManager: any
  let mockInteraction: any

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>()
    mockInteraction = mockDeep<CommandInteraction>()
    mockInteraction.guildId = "guild-123"
    mockInteraction.editReply = vi.fn()
    mockInteraction.deferReply = vi.fn()
  })

  it("should enable auto-lock successfully", async () => {
    const command = new AdminQueueAutoLockCommand(mockQueueManager)
    mockQueueManager.setScheduleEnabled.mockResolvedValue()
    mockQueueManager.checkSchedules.mockResolvedValue()

    await command.autoLock("queue1", mockInteraction)

    expect(mockQueueManager.setScheduleEnabled).toHaveBeenCalledWith("guild-123", "queue1", true)
    expect(mockQueueManager.checkSchedules).toHaveBeenCalled()
    expect(mockInteraction.editReply).toHaveBeenCalled()

    const call = mockInteraction.editReply.mock.calls[0][0]
    expect(call.embeds[0].data.title).toBe("Auto Mode Enabled")
    expect(call.embeds[0].data.description).toContain("queue1")
  })

  it("should return early when not in a guild", async () => {
    const command = new AdminQueueAutoLockCommand(mockQueueManager)
    mockInteraction.guildId = null

    await command.autoLock("queue1", mockInteraction)

    expect(mockQueueManager.setScheduleEnabled).not.toHaveBeenCalled()
    expect(mockInteraction.deferReply).not.toHaveBeenCalled()
  })

  it("should fail if queue is not found", async () => {
    const command = new AdminQueueAutoLockCommand(mockQueueManager)
    mockQueueManager.setScheduleEnabled.mockRejectedValue(new QueueNotFoundError("test-queue"))

    await command.autoLock("test-queue", mockInteraction)

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Error",
              description: "Queue \"test-queue\" not found",
            }),
          }),
        ]),
      }),
    )
  })
})
