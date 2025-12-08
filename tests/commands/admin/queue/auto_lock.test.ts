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

  it("should enable auto mode successfully", async () => {
    const command = new AdminQueueAutoLockCommand(mockQueueManager)
    mockQueueManager.setScheduleEnabled.mockResolvedValue(undefined)
    mockQueueManager.checkSchedules.mockResolvedValue(undefined)

    await command.autoLock("test-queue", mockInteraction)

    expect(mockQueueManager.setScheduleEnabled).toHaveBeenCalledWith("guild-123", "test-queue", true)
    expect(mockQueueManager.checkSchedules).toHaveBeenCalled()
    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Auto Mode Enabled",
            }),
          }),
        ]),
      }),
    )
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
