import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { AdminQueueScheduleRemoveCommand } from "@commands/admin/queue/schedule/remove"
import { QueueManager } from "@managers/QueueManager"
import { CommandInteraction } from "discord.js"
import { mockDeep } from "vitest-mock-extended"
import { QueueNotFoundError, InvalidQueueScheduleDayError } from "@errors/QueueErrors"

describe("AdminQueueScheduleRemoveCommand", () => {
  let mockQueueManager: any
  let mockInteraction: any

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>()
    mockInteraction = mockDeep<CommandInteraction>()
    mockInteraction.guildId = "guild-123"
    mockInteraction.editReply = vi.fn()
    mockInteraction.deferReply = vi.fn()

    mockQueueManager.parseDayOfWeek.mockReturnValue(1) // Monday
  })

  it("should remove schedule successfully", async () => {
    const command = new AdminQueueScheduleRemoveCommand(mockQueueManager)
    mockQueueManager.removeSchedule.mockResolvedValue(undefined)

    await command.remove("test-queue", "Monday", mockInteraction)

    expect(mockQueueManager.parseDayOfWeek).toHaveBeenCalledWith("Monday")
    expect(mockQueueManager.removeSchedule).toHaveBeenCalledWith("guild-123", "test-queue", 1)
    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Schedule Removed",
            }),
          }),
        ]),
      }),
    )
  })

  it("should fail with invalid day", async () => {
    const command = new AdminQueueScheduleRemoveCommand(mockQueueManager)
    mockQueueManager.parseDayOfWeek.mockImplementation(() => {
      throw new InvalidQueueScheduleDayError("Funday")
    })

    await command.remove("test-queue", "Funday", mockInteraction)

    expect(mockQueueManager.parseDayOfWeek).toHaveBeenCalledWith("Funday")
    expect(mockQueueManager.removeSchedule).not.toHaveBeenCalled()
    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Error",
              description: expect.stringContaining("Invalid day"),
            }),
          }),
        ]),
      }),
    )
  })

  it("should fail if queue is not found", async () => {
    const command = new AdminQueueScheduleRemoveCommand(mockQueueManager)
    mockQueueManager.removeSchedule.mockRejectedValue(new QueueNotFoundError("test-queue"))

    await command.remove("test-queue", "Monday", mockInteraction)

    expect(mockQueueManager.parseDayOfWeek).toHaveBeenCalledWith("Monday")
    expect(mockQueueManager.removeSchedule).toHaveBeenCalledWith("guild-123", "test-queue", 1)
    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Error",
              description: expect.stringContaining('Queue "test-queue" not found'),

            }),
          }),
        ]),
      }),
    )
  })
})
