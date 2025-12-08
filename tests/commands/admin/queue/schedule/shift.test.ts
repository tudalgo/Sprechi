import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { AdminQueueScheduleShiftCommand } from "@commands/admin/queue/schedule/shift"
import { QueueManager } from "@managers/QueueManager"
import { CommandInteraction } from "discord.js"
import { mockDeep } from "vitest-mock-extended"
import { QueueNotFoundError } from "@errors/QueueErrors"

describe("AdminQueueScheduleShiftCommand", () => {
  let mockQueueManager: any
  let mockInteraction: any

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>()
    mockInteraction = mockDeep<CommandInteraction>()
    mockInteraction.guildId = "guild-123"
    mockInteraction.editReply = vi.fn()
    mockInteraction.deferReply = vi.fn()
  })

  it("should set schedule shift successfully", async () => {
    const command = new AdminQueueScheduleShiftCommand(mockQueueManager)
    mockQueueManager.setScheduleShift.mockResolvedValue(undefined)

    await command.shift("test-queue", 10, mockInteraction)

    expect(mockQueueManager.setScheduleShift).toHaveBeenCalledWith("guild-123", "test-queue", 10)
    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Schedule Shift Set",
            }),
          }),
        ]),
      }),
    )
  })

  it("should fail if queue is not found", async () => {
    const command = new AdminQueueScheduleShiftCommand(mockQueueManager)
    mockQueueManager.setScheduleShift.mockRejectedValue(new QueueNotFoundError("test-queue"))

    await command.shift("test-queue", 10, mockInteraction)

    expect(mockQueueManager.setScheduleShift).toHaveBeenCalled()
    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Error",
              description: expect.stringContaining("Queue \"test-queue\" not found"),
            }),
          }),
        ]),
      }),
    )
  })
})
