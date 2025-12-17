import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { AdminQueueScheduleAddCommand } from "@commands/admin/queue/schedule/add"
import { QueueManager } from "@managers/QueueManager"
import { CommandInteraction } from "discord.js"
import { mockDeep } from "vitest-mock-extended"
import {
  QueueNotFoundError,
  InvalidQueueScheduleDayError,
  InvalidTimeFormatError,
  InvalidTimeRangeError,
} from "@errors/QueueErrors"

describe("AdminQueueScheduleAddCommand", () => {
  let mockQueueManager: any
  let mockInteraction: any

  beforeEach(() => {
    mockQueueManager = mockDeep<QueueManager>()
    mockInteraction = mockDeep<CommandInteraction>()
    mockInteraction.guildId = "guild-123"
    mockInteraction.editReply = vi.fn()
    mockInteraction.deferReply = vi.fn()

    mockQueueManager.parseDayOfWeek.mockReturnValue(1) // Monday
    mockQueueManager.validateTimeFormat.mockReturnValue(undefined)
    mockQueueManager.validateTimeRange.mockReturnValue(undefined)
  })

  it("should add schedule successfully", async () => {
    const command = new AdminQueueScheduleAddCommand(mockQueueManager)
    mockQueueManager.addSchedule.mockResolvedValue(undefined)

    await command.add("test-queue", "Monday", "08:00", "20:00", mockInteraction)

    expect(mockQueueManager.parseDayOfWeek).toHaveBeenCalledWith("Monday")
    expect(mockQueueManager.validateTimeFormat).toHaveBeenCalledWith("08:00")
    expect(mockQueueManager.validateTimeFormat).toHaveBeenCalledWith("20:00")
    expect(mockQueueManager.validateTimeRange).toHaveBeenCalledWith("08:00", "20:00")
    expect(mockQueueManager.addSchedule).toHaveBeenCalledWith("guild-123", "test-queue", 1, "08:00", "20:00")
    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Schedule Added",
            }),
          }),
        ]),
      }),
    )
  })

  it("should fail with invalid day", async () => {
    const command = new AdminQueueScheduleAddCommand(mockQueueManager)
    mockQueueManager.parseDayOfWeek.mockImplementation(() => {
      throw new InvalidQueueScheduleDayError("Funday")
    })

    await command.add("test-queue", "Funday", "08:00", "20:00", mockInteraction)

    expect(mockQueueManager.parseDayOfWeek).toHaveBeenCalledWith("Funday")
    expect(mockQueueManager.addSchedule).not.toHaveBeenCalled()
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

  it("should fail with invalid time format", async () => {
    const command = new AdminQueueScheduleAddCommand(mockQueueManager)
    mockQueueManager.validateTimeFormat.mockImplementation((time: string) => {
      if (time === "25:00") {
        throw new InvalidTimeFormatError()
      }
    })

    await command.add("test-queue", "Monday", "25:00", "20:00", mockInteraction)

    expect(mockQueueManager.parseDayOfWeek).toHaveBeenCalledWith("Monday")
    expect(mockQueueManager.validateTimeFormat).toHaveBeenCalledWith("25:00")
    expect(mockQueueManager.addSchedule).not.toHaveBeenCalled()
    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Error",
              description: expect.stringContaining("Invalid time format"),
            }),
          }),
        ]),
      }),
    )
  })

  it("should fail if start after end", async () => {
    const command = new AdminQueueScheduleAddCommand(mockQueueManager)
    mockQueueManager.validateTimeRange.mockImplementation(() => {
      throw new InvalidTimeRangeError()
    })

    await command.add("test-queue", "Monday", "20:00", "08:00", mockInteraction)

    expect(mockQueueManager.parseDayOfWeek).toHaveBeenCalledWith("Monday")
    expect(mockQueueManager.validateTimeFormat).toHaveBeenCalledWith("20:00")
    expect(mockQueueManager.validateTimeFormat).toHaveBeenCalledWith("08:00")
    expect(mockQueueManager.validateTimeRange).toHaveBeenCalledWith("20:00", "08:00")
    expect(mockQueueManager.addSchedule).not.toHaveBeenCalled()
    expect(mockInteraction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: expect.arrayContaining([
          expect.objectContaining({
            data: expect.objectContaining({
              title: "Error",
              description: expect.stringContaining("Start time must be before end time"),
            }),
          }),
        ]),
      }),
    )
  })

  it("should fail if queue is not found", async () => {
    const command = new AdminQueueScheduleAddCommand(mockQueueManager)
    mockQueueManager.addSchedule.mockRejectedValue(new QueueNotFoundError("test-queue"))

    await command.add("test-queue", "Monday", "08:00", "20:00", mockInteraction)

    expect(mockQueueManager.addSchedule).toHaveBeenCalled()
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

  it("should not execute when not in a guild", async () => {
    const command = new AdminQueueScheduleAddCommand(mockQueueManager)
    mockInteraction.guildId = null

    await command.add("test-queue", "Monday", "08:00", "20:00", mockInteraction)

    expect(mockQueueManager.addSchedule).not.toHaveBeenCalled()
    expect(mockInteraction.deferReply).not.toHaveBeenCalled()
    expect(mockInteraction.editReply).not.toHaveBeenCalled()
  })
})
