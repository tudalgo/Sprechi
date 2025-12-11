import "reflect-metadata"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { ReadyEvent } from "@events/ready"
import { GuildManager } from "@managers/GuildManager"
import { QueueManager } from "@managers/QueueManager"
import { Client } from "discord.js"
import { mockDeep } from "vitest-mock-extended"

// Mock GuildManager
vi.mock("@managers/GuildManager")
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

describe("ReadyEvent", () => {
  let readyEvent: ReadyEvent
  let mockGuildManager: any
  let mockQueueManager: any
  let mockClient: any

  beforeEach(() => {
    mockGuildManager = mockDeep<GuildManager>()
    mockQueueManager = mockDeep<QueueManager>()

    readyEvent = new ReadyEvent(mockGuildManager, mockQueueManager)
    mockClient = mockDeep<Client>()
    mockClient.user = { tag: "bot#123", username: "bot" }

    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("should sync guilds and check schedules on ready", async () => {
    mockQueueManager.checkSchedules.mockResolvedValue(undefined)

    await readyEvent.onReady([mockClient])

    expect(mockGuildManager.syncAllGuilds).toHaveBeenCalled()
    expect(mockQueueManager.checkSchedules).toHaveBeenCalled()
  })

  it("should set up schedule checking interval", async () => {
    mockQueueManager.checkSchedules.mockResolvedValue(undefined)

    await readyEvent.onReady([mockClient])

    // Should call checkSchedules initially
    expect(mockQueueManager.checkSchedules).toHaveBeenCalledTimes(1)

    // Clear mock call history but keep the timer
    mockQueueManager.checkSchedules.mockClear()

    // Advance timers to trigger interval (every minute = 60000ms)
    await vi.advanceTimersByTimeAsync(60000)

    // Should be called once by the interval
    expect(mockQueueManager.checkSchedules).toHaveBeenCalledTimes(1)
  })

  it("should handle errors from checkSchedules gracefully", async () => {
    mockQueueManager.checkSchedules.mockRejectedValue(new Error("Schedule check failed"))

    // Should not throw - errors should be caught and logged
    await expect(readyEvent.onReady([mockClient])).resolves.not.toThrow()

    expect(mockQueueManager.checkSchedules).toHaveBeenCalled()
  })
})
