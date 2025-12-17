import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { AdminQueueScheduleSummaryCommand } from "@commands/admin/queue/schedule/summary"
import { QueueManager } from "@managers/QueueManager"
import { CommandInteraction } from "discord.js"
import { mockDeep } from "vitest-mock-extended"
import { QueueNotFoundError } from "@errors/QueueErrors"

describe("AdminQueueScheduleSummaryCommand", () => {
  let mockQueueManager: any
  let mockInteraction: any

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>()
    mockInteraction = mockDeep<CommandInteraction>()
    mockInteraction.guildId = "guild-123"
    mockInteraction.editReply = vi.fn()
    mockInteraction.deferReply = vi.fn()
  })

  it("should display schedule summary successfully", async () => {
    const command = new AdminQueueScheduleSummaryCommand(mockQueueManager)
    const mockQueue = {
      id: "queue-123",
      name: "test-queue",
      scheduleEnabled: true,
      scheduleShiftMinutes: 10,
    }
    const mockSchedules = [
      { dayOfWeek: 1, startTime: "08:00", endTime: "12:00" },
      { dayOfWeek: 3, startTime: "14:00", endTime: "18:00" },
    ]
    mockQueueManager.getQueueByName.mockResolvedValue(mockQueue)
    mockQueueManager.getSchedules.mockResolvedValue(mockSchedules)

    await command.summary("test-queue", false, mockInteraction)

    expect(mockQueueManager.getQueueByName).toHaveBeenCalledWith("guild-123", "test-queue")
    expect(mockQueueManager.getSchedules).toHaveBeenCalledWith("guild-123", "test-queue")
    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Schedule Summary: test-queue",
              description: expect.stringContaining("Auto-Lock"),
            }),
          }),
        ]),
      }),
    )
  })

  it("should show message when no schedules exist", async () => {
    const command = new AdminQueueScheduleSummaryCommand(mockQueueManager)
    const mockQueue = {
      id: "queue-123",
      name: "test-queue",
      scheduleEnabled: false,
      scheduleShiftMinutes: 0,
    }
    mockQueueManager.getQueueByName.mockResolvedValue(mockQueue)
    mockQueueManager.getSchedules.mockResolvedValue([])

    await command.summary("test-queue", false, mockInteraction)

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              description: expect.stringContaining("No schedules configured"),
            }),
          }),
        ]),
      }),
    )
  })

  it("should fail if queue is not found", async () => {
    const command = new AdminQueueScheduleSummaryCommand(mockQueueManager)
    mockQueueManager.getQueueByName.mockRejectedValue(new QueueNotFoundError("test-queue"))

    await command.summary("test-queue", false, mockInteraction)

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

  it("should hide auto-lock info when hide-private-info parameter is true", async () => {
    const command = new AdminQueueScheduleSummaryCommand(mockQueueManager)
    const mockQueue = {
      id: "queue-123",
      name: "test-queue",
      scheduleEnabled: true,
      scheduleShiftMinutes: 10,
    }
    const mockSchedules = [
      { dayOfWeek: 1, startTime: "08:00", endTime: "12:00" },
      { dayOfWeek: 3, startTime: "14:00", endTime: "18:00" },
    ]
    mockQueueManager.getQueueByName.mockResolvedValue(mockQueue)
    mockQueueManager.getSchedules.mockResolvedValue(mockSchedules)

    await command.summary("test-queue", true, mockInteraction)

    expect(mockQueueManager.getQueueByName).toHaveBeenCalledWith("guild-123", "test-queue")
    expect(mockQueueManager.getSchedules).toHaveBeenCalledWith("guild-123", "test-queue")
    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Schedule Summary: test-queue",
              description: expect.not.stringContaining("Auto-Lock"),
            }),
          }),
        ]),
      }),
    )
  })

  it("should not execute when not in a guild", async () => {
    const command = new AdminQueueScheduleSummaryCommand(mockQueueManager)
    mockInteraction.guildId = null

    await command.summary("test-queue", false, mockInteraction)

    expect(mockQueueManager.getQueueByName).not.toHaveBeenCalled()
    expect(mockQueueManager.getSchedules).not.toHaveBeenCalled()
    expect(mockInteraction.deferReply).not.toHaveBeenCalled()
    expect(mockInteraction.editReply).not.toHaveBeenCalled()
  })

  it("should handle getSchedules rejection", async () => {
    const command = new AdminQueueScheduleSummaryCommand(mockQueueManager)
    const mockQueue = {
      id: "queue-123",
      name: "test-queue",
      scheduleEnabled: true,
      scheduleShiftMinutes: 10,
    }
    mockQueueManager.getQueueByName.mockResolvedValue(mockQueue)
    mockQueueManager.getSchedules.mockRejectedValue(new Error("Database error"))

    await command.summary("test-queue", false, mockInteraction)

    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Error",
            }),
          }),
        ]),
      }),
    )
  })
})
