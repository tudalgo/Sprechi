import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { QueueManager } from "@managers/QueueManager"
import db, { InternalRole } from "@db"
import { queues, queueMembers, sessions, queueSchedules } from "@db/schema"
import { bot } from "@/bot"
import { mockDeep } from "vitest-mock-extended"
import { RoomManager } from "@managers/RoomManager"
import { GuildManager } from "@managers/GuildManager"
import { InvalidTimeRangeError } from "@errors/QueueErrors"
import { InvalidQueueScheduleDayError } from "@errors/QueueErrors"
import { InvalidTimeFormatError } from "@errors/QueueErrors"

// Mock RoomManager
vi.mock("@managers/RoomManager")
// Mock GuildManager
vi.mock("@managers/GuildManager")

// Mock the db module
vi.mock("@db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@db")>()
  return {
    ...actual,
    default: {
      insert: vi.fn(),
      select: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  }
})

// Mock logger to avoid cluttering test output
vi.mock("@utils/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock bot
vi.mock("@/bot", () => ({
  bot: {
    users: {
      fetch: vi.fn(),
    },
    guilds: {
      fetch: vi.fn(),
    },
    channels: {
      fetch: vi.fn(),
    },
  },
}))

describe("QueueManager", () => {
  let queueManager: QueueManager

  let mockRoomManager: any
  let mockGuildManager: any

  beforeEach(() => {
    mockGuildManager = mockDeep<GuildManager>()
    queueManager = new QueueManager(mockGuildManager)
    mockRoomManager = mockDeep<RoomManager>()
    vi.clearAllMocks()
  })

  describe("processStudentPick", () => {
    it("should process student pick successfully", async () => {
      const mockQueue = {
        name: "test-queue",
        waitingRoomId: "waiting-room-123",
      }
      const mockSession = { id: "session-123" }
      const mockInteraction = {
        user: { username: "tutor", tag: "tutor#123" },
        guild: {
          channels: { fetch: vi.fn().mockResolvedValue({ parentId: "category-123" }) },
          members: { fetch: vi.fn().mockResolvedValue({ voice: { channel: true, setChannel: vi.fn() } }) },
          id: "guild-123",
        },
        editReply: vi.fn(),
      }
      const mockChannel = { id: "channel-123" }

      mockRoomManager.createEphemeralChannel.mockResolvedValue(mockChannel)
      vi.spyOn(queueManager, "pickStudent").mockResolvedValue(undefined)

      await queueManager.processStudentPick(
        mockInteraction as any,
        mockRoomManager,
        mockQueue as any,
        mockSession as any,
        "student-123",
        "tutor-123",
      )

      expect(mockRoomManager.createEphemeralChannel).toHaveBeenCalled()
      expect(queueManager.pickStudent).toHaveBeenCalled()
    })

    it("should throw QueueError if channel creation fails", async () => {
      const mockQueue = {
        name: "test-queue",
        waitingRoomId: "waiting-room-123",
      }
      const mockSession = { id: "session-123" }
      const mockInteraction = {
        user: { username: "tutor", tag: "tutor#123" },
        guild: {
          channels: { fetch: vi.fn().mockResolvedValue({ parentId: "category-123" }) },
        },
      }

      mockRoomManager.createEphemeralChannel.mockResolvedValue(null)

      await expect(queueManager.processStudentPick(
        mockInteraction as any,
        mockRoomManager,
        mockQueue as any,
        mockSession as any,
        "student-123",
        "tutor-123",
      )).rejects.toThrow("Failed to create session room.")
    })

    it("should continue if moving tutor fails", async () => {
      const mockQueue = {
        name: "test-queue",
        waitingRoomId: "waiting-room-123",
      }
      const mockSession = { id: "session-123" }
      const mockInteraction = {
        user: { username: "tutor", tag: "tutor#123" },
        guild: {
          channels: { fetch: vi.fn().mockResolvedValue({ parentId: "category-123" }) },
          members: {
            fetch: vi.fn().mockResolvedValue({
              voice: {
                channel: true,
                setChannel: vi.fn().mockRejectedValue(new Error("Move failed")),
              },
            }),
          },
          id: "guild-123",
        },
        editReply: vi.fn(),
      }
      const mockChannel = { id: "channel-123" }

      mockRoomManager.createEphemeralChannel.mockResolvedValue(mockChannel)
      vi.spyOn(queueManager, "pickStudent").mockResolvedValue(undefined)

      await queueManager.processStudentPick(
        mockInteraction as any,
        mockRoomManager,
        mockQueue as any,
        mockSession as any,
        "student-123",
        "tutor-123",
      )

      expect(queueManager.pickStudent).toHaveBeenCalled()
    })
  })

  describe("resolveQueue", () => {
    it("should resolve queue by name", async () => {
      const mockQueue = { name: "test-queue" }
      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)

      const result = await queueManager.resolveQueue("guild-123", "test-queue")
      expect(result).toEqual(mockQueue)
    })

    it("should throw QueueNotFoundError if queue name provided but not found", async () => {
      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(null as any)

      await expect(queueManager.resolveQueue("guild-123", "non-existent"))
        .rejects.toThrow("Queue \"non-existent\" not found")
    })

    it("should resolve single queue if no name provided", async () => {
      const mockQueue = { name: "test-queue" }
      vi.spyOn(queueManager, "listQueues").mockResolvedValue([mockQueue] as any)

      const result = await queueManager.resolveQueue("guild-123")
      expect(result).toEqual(mockQueue)
    })

    it("should throw error if multiple queues and no name provided", async () => {
      vi.spyOn(queueManager, "listQueues").mockResolvedValue([{}, {}] as any)

      await expect(queueManager.resolveQueue("guild-123"))
        .rejects.toThrow("Multiple queues found. Please specify a queue name.")
    })

    it("should throw error if no queues found", async () => {
      vi.spyOn(queueManager, "listQueues").mockResolvedValue([])
      await expect(queueManager.resolveQueue("guild-123"))
        .rejects.toThrow("No queues found in this server.")
    })
  })

  describe("createQueue", () => {
    it("should create a queue successfully", async () => {
      const mockQueueData = {
        guildId: "guild-123",
        name: "test-queue",
        description: "A test queue",
      }

      const mockCreatedQueue = {
        id: "queue-123",
        ...mockQueueData,
        isLocked: false,
        waitingRoomId: null,
        privateLogChannelId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Mock db.insert chain
      const returningMock = vi.fn().mockResolvedValue([mockCreatedQueue])
      const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      (db.insert as any).mockReturnValue({ values: valuesMock })

      const result = await queueManager.createQueue(mockQueueData)

      expect(db.insert).toHaveBeenCalledWith(queues)
      expect(valuesMock).toHaveBeenCalledWith({
        guildId: mockQueueData.guildId,
        name: mockQueueData.name,
        description: mockQueueData.description,
        isLocked: false,
      })
      expect(result).toEqual(mockCreatedQueue)
    })
  })

  describe("getQueueByName", () => {
    it("should return a queue if it exists", async () => {
      const mockQueue = {
        id: "queue-123",
        guildId: "guild-123",
        name: "test-queue",
      }

      // Mock db.select chain
      const whereMock = vi.fn().mockResolvedValue([mockQueue])
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      const result = await queueManager.getQueueByName("guild-123", "test-queue")

      expect(result).toEqual(mockQueue)
    })

    it("should return null if queue does not exist", async () => {
      // Mock db.select chain
      const whereMock = vi.fn().mockResolvedValue([])
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      const result = await queueManager.getQueueByName("guild-123", "non-existent")

      expect(result).toBeNull()
    })
  })

  describe("setWaitingRoom", () => {
    it("should set waiting room successfully", async () => {
      const mockQueue = {
        id: "queue-123",
        guildId: "guild-123",
        name: "test-queue",
        waitingRoomId: "channel-123",
      }

      // Mock db.update chain
      const returningMock = vi.fn().mockResolvedValue([mockQueue])
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock })
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.update as any).mockReturnValue({ set: setMock })

      await queueManager.setWaitingRoom("guild-123", "test-queue", "channel-123")

      expect(db.update).toHaveBeenCalledWith(queues)
      expect(setMock).toHaveBeenCalledWith({ waitingRoomId: "channel-123" })
    })

    it("should throw QueueNotFoundError if queue does not exist", async () => {
      // Mock db.update chain
      const returningMock = vi.fn().mockResolvedValue([])
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock })
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.update as any).mockReturnValue({ set: setMock })

      await expect(queueManager.setWaitingRoom("guild-123", "non-existent", "channel-123"))
        .rejects.toThrow("Queue \"non-existent\" not found")
    })
  })

  describe("setPrivateLogChannel", () => {
    it("should set private log channel successfully", async () => {
      const mockQueue = {
        id: "queue-123",
        guildId: "guild-123",
        name: "test-queue",
        privateLogChannelId: "channel-456",
      }

      // Mock db.update chain
      const returningMock = vi.fn().mockResolvedValue([mockQueue])
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock })
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      // Cast to any to mock the chain
      (db.update as any).mockReturnValue({ set: setMock })

      await queueManager.setPrivateLogChannel("guild-123", "test-queue", "channel-456")

      expect(db.update).toHaveBeenCalledWith(queues)
      expect(setMock).toHaveBeenCalledWith({ privateLogChannelId: "channel-456" })
    })

    it("should throw QueueNotFoundError if queue does not exist", async () => {
      // Mock db.update chain
      const returningMock = vi.fn().mockResolvedValue([])
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock })
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.update as any).mockReturnValue({ set: setMock })

      await expect(queueManager.setPrivateLogChannel("guild-123", "non-existent", "channel-456"))
        .rejects.toThrow("Queue \"non-existent\" not found")
    })
  })
  describe("listQueues", () => {
    it("should list queues with stats", async () => {
      const mockQueue = {
        id: "queue-123",
        guildId: "guild-123",
        name: "test-queue",
        memberCount: 5,
        sessionCount: 2,
      }

      const mockDbResult = [{
        queue: { ...mockQueue },
        memberCount: 5,
        sessionCount: 2,
      }]

      // Mock db chain for listQueues
      const groupByMock = vi.fn().mockResolvedValue(mockDbResult)
      const whereMock = vi.fn().mockReturnValue({ groupBy: groupByMock })
      const leftJoin2Mock = vi.fn().mockReturnValue({ where: whereMock })
      const leftJoin1Mock = vi.fn().mockReturnValue({ leftJoin: leftJoin2Mock })
      const fromMock = vi.fn().mockReturnValue({ leftJoin: leftJoin1Mock });
      (db.select as any).mockReturnValue({ from: fromMock })

      const result = await queueManager.listQueues("guild-123")

      expect(result).toEqual([mockQueue])
    })
  })

  describe("deleteQueue", () => {
    it("should delete a queue successfully", async () => {
      // Mock db.delete chain
      const returningMock = vi.fn().mockResolvedValue([{ id: "queue-123" }])
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      (db.delete as any).mockReturnValue({ where: whereMock })

      const result = await queueManager.deleteQueue("guild-123", "test-queue")

      expect(result).toBe(true)
    })

    it("should return false if queue not found", async () => {
      // Mock db.delete chain
      const returningMock = vi.fn().mockResolvedValue([])
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock });
      (db.delete as any).mockReturnValue({ where: whereMock })

      const result = await queueManager.deleteQueue("guild-123", "non-existent")

      expect(result).toBe(false)
    })
  })

  describe("joinQueue", () => {
    it("should join queue successfully", async () => {
      const mockQueue = {
        id: "queue-123",
        guildId: "guild-123",
        name: "test-queue",
        isLocked: false,
      }

      // Mock getQueueByName
      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)

      // Mock getActiveSession (no active session)
      vi.spyOn(queueManager, "getActiveSession").mockResolvedValue(null as any)

      // Mock existing member check (not in queue)
      const whereMock = vi.fn().mockResolvedValue([])
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      // Mock db.insert
      (db.insert as any).mockReturnValue({ values: vi.fn().mockResolvedValue([]) })

      // Mock logToChannel and sendJoinDm
      const logToChannel = vi.spyOn(queueManager as any, "logToChannel")
      const sendJoinDm = vi.spyOn(queueManager as any, "sendJoinDm")

      await queueManager.joinQueue("guild-123", "test-queue", "user-123")

      expect(db.insert).toHaveBeenCalled()
      expect(logToChannel).toHaveBeenCalled()
      expect(sendJoinDm).toHaveBeenCalled()
    })

    it("should throw QueueNotFoundError if queue does not exist", async () => {
      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(null as any)

      await expect(queueManager.joinQueue("guild-123", "non-existent", "user-123"))
        .rejects.toThrow("Queue \"non-existent\" not found")
    })

    it("should throw QueueLockedError if queue is locked", async () => {
      const mockQueue = {
        id: "queue-123",
        guildId: "guild-123",
        name: "test-queue",
        isLocked: true,
      }

      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)

      await expect(queueManager.joinQueue("guild-123", "test-queue", "user-123"))
        .rejects.toThrow("Queue \"test-queue\" is locked")
    })

    it("should throw AlreadyInQueueError if user is already in queue and active", async () => {
      const mockQueue = {
        id: "queue-123",
        guildId: "guild-123",
        name: "test-queue",
        isLocked: false,
      }

      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)

      // Mock getActiveSession (no active session)
      vi.spyOn(queueManager, "getActiveSession").mockResolvedValue(null as any)

      // Mock existing member check (active)
      const mockMember = { id: "member-123", leftAt: null }
      const whereMock = vi.fn().mockResolvedValue([mockMember])
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      await expect(queueManager.joinQueue("guild-123", "test-queue", "user-123"))
        .rejects.toThrow("Already in queue \"test-queue\"")
    })

    it("should restore position if rejoining within grace period", async () => {
      const mockQueue = {
        id: "queue-123",
        guildId: "guild-123",
        name: "test-queue",
        isLocked: false,
      }

      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)

      // Mock getActiveSession (no active session)
      vi.spyOn(queueManager, "getActiveSession").mockResolvedValue(null as any)

      // Mock existing member check (left recently)
      const leftAt = new Date() // Just left
      const mockMember = { id: "member-123", leftAt: leftAt.toISOString() }
      const whereMock = vi.fn().mockResolvedValue([mockMember])
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      // Mock db.update
      const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
      (db.update as any).mockReturnValue({ set: setMock })

      const logToChannel = vi.spyOn(queueManager as any, "logToChannel")
      const sendJoinDm = vi.spyOn(queueManager as any, "sendJoinDm")

      await queueManager.joinQueue("guild-123", "test-queue", "user-123")

      expect(db.update).toHaveBeenCalledWith(queueMembers)
      expect(setMock).toHaveBeenCalledWith({ leftAt: null })
      expect(logToChannel).toHaveBeenCalledWith(mockQueue, expect.stringContaining("restored position"))
      expect(sendJoinDm).toHaveBeenCalled()
    })

    it("should treat as new join if rejoining after grace period", async () => {
      const mockQueue = {
        id: "queue-123",
        guildId: "guild-123",
        name: "test-queue",
        isLocked: false,
      }

      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)

      // Mock getActiveSession (no active session)
      vi.spyOn(queueManager, "getActiveSession").mockResolvedValue(null as any)

      // Mock existing member check (left long ago)
      const leftAt = new Date(Date.now() - 70000) // 70s ago
      const mockMember = { id: "member-123", leftAt: leftAt.toISOString() }
      const whereMock = vi.fn().mockResolvedValue([mockMember])
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      // Mock db.delete
      (db.delete as any).mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
      // Mock db.insert
      (db.insert as any).mockReturnValue({ values: vi.fn().mockResolvedValue([]) })

      const logToChannel = vi.spyOn(queueManager as any, "logToChannel")
      const sendJoinDm = vi.spyOn(queueManager as any, "sendJoinDm")

      await queueManager.joinQueue("guild-123", "test-queue", "user-123")

      expect(logToChannel).toHaveBeenCalledWith(mockQueue, expect.stringContaining("joined the queue"))
      expect(sendJoinDm).toHaveBeenCalled()
    })

    it("should not throw if DM fails", async () => {
      const mockQueue = {
        id: "queue-123",
        guildId: "guild-123",
        name: "test-queue",
        isLocked: false,
      }

      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)

      // Mock getActiveSession (no active session)
      vi.spyOn(queueManager, "getActiveSession").mockResolvedValue(null as any)

      // Mock not in queue
      const whereMock = vi.fn().mockResolvedValue([])
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      (db.insert as any).mockReturnValue({ values: vi.fn().mockResolvedValue([]) });

      // Mock DM failure
      (bot.users.fetch as any).mockResolvedValue({
        send: vi.fn().mockRejectedValue(new Error("DM failed")),
      })

      await expect(queueManager.joinQueue("guild-123", "test-queue", "user-123"))
        .resolves.not.toThrow()
    })

    it("should not throw if logToChannel fails", async () => {
      const mockQueue = {
        id: "queue-123",
        guildId: "guild-123",
        name: "test-queue",
        isLocked: false,
        privateLogChannelId: "log-channel-123",
      }

      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)

      // Mock getActiveSession (no active session)
      vi.spyOn(queueManager, "getActiveSession").mockResolvedValue(null as any)

      // Mock not in queue
      const whereMock = vi.fn().mockResolvedValue([])
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock });

      (db.insert as any).mockReturnValue({ values: vi.fn().mockResolvedValue([]) });

      // Mock log channel failure
      (bot.channels.fetch as any).mockRejectedValue(new Error("Channel fetch failed"))

      await expect(queueManager.joinQueue("guild-123", "test-queue", "user-123"))
        .resolves.not.toThrow()
    })
  })

  it("should include active session role ping in log", async () => {
    const mockQueue = {
      id: "queue-123",
      guildId: "guild-123",
      name: "test-queue",
      isLocked: false,
      privateLogChannelId: "log-123",
    }

    vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)
    vi.spyOn(queueManager, "getActiveSession").mockResolvedValue(null as any)

    // Mock member check
    const whereMock = vi.fn().mockResolvedValue([])
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    (db.select as any).mockReturnValue({ from: fromMock });
    (db.insert as any).mockReturnValue({ values: vi.fn().mockResolvedValue([]) })

    // Mock GuildManager to return a role
    mockGuildManager.getRole.mockResolvedValue("role-123")

    // Mock channel fetch and send
    const mockChannel = {
      type: 0, // GuildText
      send: vi.fn(),
    }
      ; (bot.channels.fetch as any).mockResolvedValue(mockChannel)
    ; (bot.users.fetch as any).mockResolvedValue({ send: vi.fn() })

    await queueManager.joinQueue("guild-123", "test-queue", "user-123")

    expect(bot.channels.fetch).toHaveBeenCalledWith("log-123")
    expect(mockGuildManager.getRole).toHaveBeenCalledWith("guild-123", InternalRole.ActiveSession)
    expect(mockChannel.send).toHaveBeenCalledWith(expect.objectContaining({
      content: "<@&role-123> ",
    }))
  })

  describe("leaveQueue", () => {
    it("should leave queue successfully", async () => {
      const mockQueue = {
        id: "queue-123",
        guildId: "guild-123",
        name: "test-queue",
      }

      const mockMember = {
        id: "member-123",
        userId: "user-123",
      }

      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)

      // Mock member check
      const whereMock = vi.fn().mockResolvedValue([mockMember])
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      // Mock db.update
      const whereUpdateMock = vi.fn().mockResolvedValue([])
      const setMock = vi.fn().mockReturnValue({ where: whereUpdateMock });
      (db.update as any).mockReturnValue({ set: setMock })

      // Mock logToChannel
      const logToChannel = vi.spyOn(queueManager as any, "logToChannel")

      await queueManager.leaveQueue("guild-123", "test-queue", "user-123")

      expect(db.update).toHaveBeenCalled()
      expect(logToChannel).toHaveBeenCalled()
    })

    it("should throw QueueNotFoundError if queue does not exist", async () => {
      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(null as any)

      await expect(queueManager.leaveQueue("guild-123", "non-existent", "user-123"))
        .rejects.toThrow("Queue \"non-existent\" not found")
    })

    it("should throw NotInQueueError if user is not in queue", async () => {
      const mockQueue = {
        id: "queue-123",
        guildId: "guild-123",
        name: "test-queue",
      }

      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)

      // Mock member check
      const whereMock = vi.fn().mockResolvedValue([])
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      await expect(queueManager.leaveQueue("guild-123", "test-queue", "user-123"))
        .rejects.toThrow("Not in queue \"test-queue\"")
    })

    it("should disconnect user from waiting room if configured", async () => {
      const mockQueue = {
        id: "queue-123",
        guildId: "guild-123",
        name: "test-queue",
        waitingRoomId: "voice-123",
      }
      const mockMember = { id: "member-123", userId: "user-123" }

      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)

      // Mock member check
      const whereMock = vi.fn().mockResolvedValue([mockMember])
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      // Mock db.update
      const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
      (db.update as any).mockReturnValue({ set: setMock })

      // Mock bot interactions
      const mockVoiceMember = {
        voice: {
          channelId: "voice-123",
          disconnect: vi.fn().mockResolvedValue(undefined),
        },
      }
      const mockGuild = {
        members: {
          fetch: vi.fn().mockResolvedValue(mockVoiceMember),
        },
      };
      (bot.guilds.fetch as any).mockResolvedValue(mockGuild);
      (bot.users.fetch as any).mockResolvedValue({ send: vi.fn() })

      await queueManager.leaveQueue("guild-123", "test-queue", "user-123")

      expect(bot.guilds.fetch).toHaveBeenCalledWith("guild-123")
      expect(mockGuild.members.fetch).toHaveBeenCalledWith("user-123")
      expect(mockVoiceMember.voice.disconnect).toHaveBeenCalled()
    })

    it("should not throw if DM fails", async () => {
      const mockQueue = {
        id: "queue-123",
        guildId: "guild-123",
        name: "test-queue",
      }
      const mockMember = { id: "member-123", userId: "user-123" }

      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)

      const whereMock = vi.fn().mockResolvedValue([mockMember])
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
      (db.update as any).mockReturnValue({ set: setMock });

      (bot.users.fetch as any).mockResolvedValue({
        send: vi.fn().mockRejectedValue(new Error("DM failed")),
      })

      await expect(queueManager.leaveQueue("guild-123", "test-queue", "user-123"))
        .resolves.not.toThrow()
    })

    it("should cleanup member after grace period", async () => {
      vi.useFakeTimers()
      const mockQueue = {
        id: "queue-123",
        guildId: "guild-123",
        name: "test-queue",
      }
      const mockMember = { id: "member-123", userId: "user-123" }

      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)

      // Initial check
      const whereMock = vi.fn().mockResolvedValue([mockMember])
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
      (db.update as any).mockReturnValue({ set: setMock })

      await queueManager.leaveQueue("guild-123", "test-queue", "user-123")

      // Fast forward time
      const leftAt = new Date(Date.now() - 61000) // 61s ago
      const mockMemberExpired = { id: "member-123", leftAt: leftAt.toISOString() }

      // Mock select inside setTimeout
      whereMock.mockResolvedValue([mockMemberExpired])

      // Mock delete
      const whereDeleteMock = vi.fn().mockResolvedValue([]);
      (db.delete as any).mockReturnValue({ where: whereDeleteMock })

      vi.runAllTimers()

      // Wait for promises to resolve
      await Promise.resolve()
      await Promise.resolve()

      expect(db.delete).toHaveBeenCalledWith(queueMembers)

      vi.useRealTimers()
    })
  })

  describe("createSession", () => {
    it("should create session successfully", async () => {
      const mockQueue = {
        id: "queue-123",
        guildId: "guild-123",
        name: "test-queue",
      }

      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)

      // Mock active session check (none)
      const whereMock = vi.fn().mockResolvedValue([])
      const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock })
      const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      // Mock getQueueByUser (not in queue)
      vi.spyOn(queueManager, "getQueueByUser").mockResolvedValue(null as any);

      // Mock db.insert
      (db.insert as any).mockReturnValue({ values: vi.fn().mockResolvedValue([]) })

      await queueManager.createSession("guild-123", "test-queue", "tutor-123")

      expect(db.insert).toHaveBeenCalled()
    })

    it("should throw SessionAlreadyActiveError if tutor has active session", async () => {
      const mockQueue = {
        id: "queue-123",
        guildId: "guild-123",
        name: "test-queue",
      }

      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)

      // Mock active session check (exists)
      const whereMock = vi.fn().mockResolvedValue([{ id: "session-123" }])
      const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock })
      const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      await expect(queueManager.createSession("guild-123", "test-queue", "tutor-123"))
        .rejects.toThrow("You already have an active session")
    })

    it("should throw QueueNotFoundError if queue does not exist", async () => {
      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(null as any)
      await expect(queueManager.createSession("guild-123", "non-existent", "tutor-123"))
        .rejects.toThrow("Queue \"non-existent\" not found")
    })

    it("should assign active_session role on session start", async () => {
      const mockQueue = { id: "queue-123", guildId: "guild-123", name: "test-queue" }
      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)

      const whereMock = vi.fn().mockResolvedValue([])
      const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock })
      const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      vi.spyOn(queueManager, "getQueueByUser").mockResolvedValue(null as any);
      (db.insert as any).mockReturnValue({ values: vi.fn().mockResolvedValue([]) })

      // Mock Role assignment
      mockGuildManager.getRole.mockResolvedValue("role-123")
      const mockMember = { roles: { add: vi.fn() } }
      const mockGuild = { members: { fetch: vi.fn().mockResolvedValue(mockMember) } }
        ; (bot.guilds.fetch as any).mockResolvedValue(mockGuild)

      await queueManager.createSession("guild-123", "test-queue", "tutor-123")

      expect(mockGuildManager.getRole).toHaveBeenCalledWith("guild-123", InternalRole.ActiveSession)
      expect(mockMember.roles.add).toHaveBeenCalledWith("role-123")
    })
  })

  describe("endSession", () => {
    it("should end session successfully and remove role", async () => {
      const mockQueue = { id: "queue-123", guildId: "guild-123", name: "test-queue", privateLogChannelId: "log-123" }
      const mockSession = { id: "session-123", tutorId: "tutor-123" }

      vi.spyOn(queueManager, "getActiveSession").mockResolvedValue({ session: mockSession, queue: mockQueue } as any)

      const returningMock = vi.fn().mockResolvedValue([mockSession])
      const whereMock = vi.fn().mockReturnValue({ returning: returningMock })
      const setMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.update as any).mockReturnValue({ set: setMock })

      // Mock Role removal
      mockGuildManager.getRole.mockResolvedValue("role-123")
      const mockMember = { roles: { remove: vi.fn() } }
      const mockGuild = { members: { fetch: vi.fn().mockResolvedValue(mockMember) } }
        ; (bot.guilds.fetch as any).mockResolvedValue(mockGuild)
      ; (bot.channels.fetch as any).mockResolvedValue({ send: vi.fn() }) // for logToChannel

      await queueManager.endSession("guild-123", "tutor-123")

      expect(db.update).toHaveBeenCalledWith(sessions)
      expect(mockGuildManager.getRole).toHaveBeenCalledWith("guild-123", InternalRole.ActiveSession)
      expect(mockMember.roles.remove).toHaveBeenCalledWith("role-123")
    })

    it("should throw error if no active session", async () => {
      vi.spyOn(queueManager, "getActiveSession").mockResolvedValue(null as any)
      await expect(queueManager.endSession("guild-123", "tutor-123"))
        .rejects.toThrow("You do not have an active session.")
    })
  })

  describe("getActiveSession", () => {
    it("should return active session", async () => {
      const mockSession = {
        session: { id: "session-123" },
        queue: { id: "queue-123" },
      }

      // Mock db.select chain
      const whereMock = vi.fn().mockResolvedValue([mockSession])
      const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock })
      const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      const result = await queueManager.getActiveSession("guild-123", "tutor-123")

      expect(result).toEqual(mockSession)
    })
  })

  describe("pickStudent", () => {
    it("should pick student successfully", async () => {
      const mockQueue = {
        id: "queue-123",
        guildId: "guild-123",
        name: "test-queue",
      }

      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)

      // Mock db.delete
      const whereDeleteMock = vi.fn().mockResolvedValue([]);
      (db.delete as any).mockReturnValue({ where: whereDeleteMock });

      // Mock db.insert
      (db.insert as any).mockReturnValue({ values: vi.fn().mockResolvedValue([]) })

      await queueManager.pickStudent("guild-123", "test-queue", "student-123", "session-123", "tutor-123", "channel-123")

      expect(db.delete).toHaveBeenCalled()
      expect(db.insert).toHaveBeenCalled()
    })

    it("should not throw if DM fails", async () => {
      const mockQueue = {
        id: "queue-123",
        guildId: "guild-123",
        name: "test-queue",
      }

      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any);

      (db.delete as any).mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
      (db.insert as any).mockReturnValue({ values: vi.fn().mockResolvedValue([]) });

      (bot.users.fetch as any).mockResolvedValue({
        send: vi.fn().mockRejectedValue(new Error("DM failed")),
      })

      await expect(queueManager.pickStudent("guild-123", "test-queue", "student-123", "session-123", "tutor-123", "channel-123"))
        .resolves.not.toThrow()
    })

    it("should throw QueueNotFoundError if queue does not exist", async () => {
      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(null as any)
      await expect(queueManager.pickStudent("guild-123", "non-existent", "student-123", "session-123", "tutor-123", "channel-123"))
        .rejects.toThrow("Queue \"non-existent\" not found")
    })
  })

  describe("getQueueMembers", () => {
    it("should return queue members", async () => {
      const mockQueue = {
        id: "queue-123",
        guildId: "guild-123",
        name: "test-queue",
      }

      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)

      const mockMembers = [{ userId: "user-1" }, { userId: "user-2" }]

      // Mock db.select chain
      const orderByMock = vi.fn().mockResolvedValue(mockMembers)
      const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock })
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      const result = await queueManager.getQueueMembers("guild-123", "test-queue")

      expect(result).toEqual(mockMembers)
    })

    it("should respect limit", async () => {
      const mockQueue = { id: "queue-123" }
      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)

      const limitMock = vi.fn().mockResolvedValue([])
      const orderByMock = vi.fn().mockReturnValue({ limit: limitMock })
      const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock })
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      await queueManager.getQueueMembers("guild-123", "test-queue", 5)
      expect(limitMock).toHaveBeenCalledWith(5)
    })

    it("should throw QueueNotFoundError if queue not found", async () => {
      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(null as any)
      await expect(queueManager.getQueueMembers("guild-123", "non-existent"))
        .rejects.toThrow("Queue \"non-existent\" not found")
    })
  })
  describe("getQueueByUser", () => {
    it("should return queue for user", async () => {
      const mockQueue = { id: "queue-123" }
      const mockMember = { queue: mockQueue }

      // Mock db.select chain
      const whereMock = vi.fn().mockResolvedValue([mockMember])
      const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock })
      const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      const result = await queueManager.getQueueByUser("guild-123", "user-123")

      expect(result).toEqual(mockQueue)
    })
  })

  describe("getQueueByWaitingRoom", () => {
    it("should return queue by waiting room", async () => {
      const mockQueue = { id: "queue-123" }

      // Mock db.select chain
      const whereMock = vi.fn().mockResolvedValue([mockQueue])
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      const result = await queueManager.getQueueByWaitingRoom("guild-123", "channel-123")

      expect(result).toEqual(mockQueue)
    })
  })

  describe("getQueuePosition", () => {
    it("should return queue position", async () => {
      const mockMembers = [{ userId: "user-1" }, { userId: "user-2" }]

      // Mock db.select chain
      const orderByMock = vi.fn().mockResolvedValue(mockMembers)
      const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock })
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      const result = await queueManager.getQueuePosition("queue-123", "user-2")

      expect(result).toBe(2)
    })
  })

  describe("getQueueById", () => {
    it("should return queue by id", async () => {
      const mockQueue = { id: "queue-123" }

      // Mock db.select chain
      const whereMock = vi.fn().mockResolvedValue([mockQueue])
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      const result = await queueManager.getQueueById("queue-123")

      expect(result).toEqual(mockQueue)
    })
  })

  describe("getQueueMember", () => {
    it("should return queue member", async () => {
      const mockMember = { id: "member-123" }

      // Mock db.select chain
      const whereMock = vi.fn().mockResolvedValue([mockMember])
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      const result = await queueManager.getQueueMember("queue-123", "user-123")

      expect(result).toEqual(mockMember)
    })
  })
  describe("getAllActiveSessions", () => {
    it("should return active sessions with stats", async () => {
      const mockSession = {
        id: "session-123",
        queueId: "queue-123",
        tutorId: "tutor-123",
        startTime: new Date(),
        endTime: null,
      }
      const mockDbResult = [{
        session: mockSession,
        queueName: "test-queue",
        studentCount: 3,
      }]

      // Mock db chain
      const groupByMock = vi.fn().mockResolvedValue(mockDbResult)
      const whereMock = vi.fn().mockReturnValue({ groupBy: groupByMock })
      const leftJoin2Mock = vi.fn().mockReturnValue({ where: whereMock })
      const innerJoinMock = vi.fn().mockReturnValue({ leftJoin: leftJoin2Mock })
      const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      const result = await queueManager.getAllActiveSessions("guild-123")

      expect(result).toEqual([{
        ...mockSession,
        queueName: "test-queue",
        studentCount: 3,
      }])
    })
  })

  describe("terminateSessionsByUser", () => {
    it("should terminate sessions for user", async () => {
      const mockSession = { id: "session-123", tutorId: "tutor-123" }
      const mockQueue = { id: "queue-123", name: "test-queue", privateLogChannelId: "log-123" }
      const mockActiveSessions = [{ session: mockSession, queue: mockQueue }]

      // Mock select
      const whereSelectMock = vi.fn().mockResolvedValue(mockActiveSessions)
      const innerJoinMock = vi.fn().mockReturnValue({ where: whereSelectMock })
      const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      // Mock update
      const whereUpdateMock = vi.fn().mockResolvedValue([])
      const setMock = vi.fn().mockReturnValue({ where: whereUpdateMock });
      (db.update as any).mockReturnValue({ set: setMock })

      // Mock logToChannel
      const logToChannel = vi.spyOn(queueManager as any, "logToChannel")

      const count = await queueManager.terminateSessionsByUser("guild-123", "tutor-123")

      expect(count).toBe(1)
      expect(db.update).toHaveBeenCalledWith(sessions)
      expect(logToChannel).toHaveBeenCalled()
    })

    it("should return 0 if no sessions found", async () => {
      // Mock select empty
      const whereSelectMock = vi.fn().mockResolvedValue([])
      const innerJoinMock = vi.fn().mockReturnValue({ where: whereSelectMock })
      const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      const count = await queueManager.terminateSessionsByUser("guild-123", "tutor-123")

      expect(count).toBe(0)
      expect(db.update).not.toHaveBeenCalled()
    })
  })

  describe("terminateAllSessions", () => {
    it("should terminate all sessions", async () => {
      const mockSession = { id: "session-123", tutorId: "tutor-123" }
      const mockQueue = { id: "queue-123", name: "test-queue", privateLogChannelId: "log-123" }
      const mockActiveSessions = [{ session: mockSession, queue: mockQueue }]

      // Mock select
      const whereSelectMock = vi.fn().mockResolvedValue(mockActiveSessions)
      const innerJoinMock = vi.fn().mockReturnValue({ where: whereSelectMock })
      const fromMock = vi.fn().mockReturnValue({ innerJoin: innerJoinMock });
      (db.select as any).mockReturnValue({ from: fromMock })

      // Mock update
      const whereUpdateMock = vi.fn().mockResolvedValue([])
      const setMock = vi.fn().mockReturnValue({ where: whereUpdateMock });
      (db.update as any).mockReturnValue({ set: setMock })

      // Mock logToChannel
      const logToChannel = vi.spyOn(queueManager as any, "logToChannel")

      const count = await queueManager.terminateAllSessions("guild-123")

      expect(count).toBe(1)
      expect(db.update).toHaveBeenCalledWith(sessions)
      expect(logToChannel).toHaveBeenCalled()
    })
  })

  describe("setQueueLockState", () => {
    it("should set lock state successfully", async () => {
      const mockQueue = { id: "queue-123", isLocked: false, name: "test-queue" }
      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)

      // Mock update
      const whereUpdateMock = vi.fn().mockResolvedValue([])
      const setMock = vi.fn().mockReturnValue({ where: whereUpdateMock });
      (db.update as any).mockReturnValue({ set: setMock })

      await queueManager.setQueueLockState("guild-123", "test-queue", true)

      expect(db.update).toHaveBeenCalledWith(queues)
      expect(setMock).toHaveBeenCalledWith({ isLocked: true })
    })

    it("should throw QueueError if already in state", async () => {
      const mockQueue = { id: "queue-123", isLocked: true, name: "test-queue" }
      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)

      await expect(queueManager.setQueueLockState("guild-123", "test-queue", true))
        .rejects.toThrow("Queue \"test-queue\" is already locked.")
    })

    it("should throw QueueNotFoundError if queue not found", async () => {
      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(null as any)

      await expect(queueManager.setQueueLockState("guild-123", "test-queue", true))
        .rejects.toThrow("Queue \"test-queue\" not found")
    })

    it("should deny Connect permission for verified role in waiting room when locking", async () => {
      const mockQueue = {
        id: "queue-123",
        isLocked: false,
        name: "test-queue",
        waitingRoomId: "waiting-room-123",
      }
      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)

      // Mock update
      const whereUpdateMock = vi.fn().mockResolvedValue([])
      const setMock = vi.fn().mockReturnValue({ where: whereUpdateMock });
      (db.update as any).mockReturnValue({ set: setMock })

      // Mock GuildManager to return verified role
      mockGuildManager.getRole.mockResolvedValue("verified-role-123")

      // Mock Discord channel
      const mockPermissionOverwrites = {
        edit: vi.fn().mockResolvedValue(undefined),
      }
      const mockChannel = {
        isVoiceBased: () => true,
        permissionOverwrites: mockPermissionOverwrites,
      }
      const mockGuild = {
        channels: {
          fetch: vi.fn().mockResolvedValue(mockChannel),
        },
      };
      (bot.guilds.fetch as any).mockResolvedValue(mockGuild)

      await queueManager.setQueueLockState("guild-123", "test-queue", true)

      expect(mockGuildManager.getRole).toHaveBeenCalledWith("guild-123", InternalRole.Verified)
      expect(bot.guilds.fetch).toHaveBeenCalledWith("guild-123")
      expect(mockGuild.channels.fetch).toHaveBeenCalledWith("waiting-room-123")
      expect(mockPermissionOverwrites.edit).toHaveBeenCalledWith("verified-role-123", {
        Connect: false,
      })
    })

    it("should set Connect permission to true for verified role in waiting room when unlocking", async () => {
      const mockQueue = {
        id: "queue-123",
        isLocked: true,
        name: "test-queue",
        waitingRoomId: "waiting-room-123",
      }
      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)

      // Mock update
      const whereUpdateMock = vi.fn().mockResolvedValue([])
      const setMock = vi.fn().mockReturnValue({ where: whereUpdateMock });
      (db.update as any).mockReturnValue({ set: setMock })

      // Mock GuildManager to return verified role
      mockGuildManager.getRole.mockResolvedValue("verified-role-123")

      // Mock Discord channel
      const mockPermissionOverwrites = {
        edit: vi.fn().mockResolvedValue(undefined),
      }
      const mockChannel = {
        isVoiceBased: () => true,
        permissionOverwrites: mockPermissionOverwrites,
      }
      const mockGuild = {
        channels: {
          fetch: vi.fn().mockResolvedValue(mockChannel),
        },
      };
      (bot.guilds.fetch as any).mockResolvedValue(mockGuild)

      await queueManager.setQueueLockState("guild-123", "test-queue", false)

      expect(mockGuildManager.getRole).toHaveBeenCalledWith("guild-123", InternalRole.Verified)
      expect(bot.guilds.fetch).toHaveBeenCalledWith("guild-123")
      expect(mockGuild.channels.fetch).toHaveBeenCalledWith("waiting-room-123")
      expect(mockPermissionOverwrites.edit).toHaveBeenCalledWith("verified-role-123", {
        Connect: true,
      })
    })

    it("should work normally when queue has no waiting room", async () => {
      const mockQueue = {
        id: "queue-123",
        isLocked: false,
        name: "test-queue",
        waitingRoomId: null,
      }
      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)

      // Mock update
      const whereUpdateMock = vi.fn().mockResolvedValue([])
      const setMock = vi.fn().mockReturnValue({ where: whereUpdateMock });
      (db.update as any).mockReturnValue({ set: setMock })

      await queueManager.setQueueLockState("guild-123", "test-queue", true)

      expect(db.update).toHaveBeenCalledWith(queues)
      expect(setMock).toHaveBeenCalledWith({ isLocked: true })
      // Should not try to fetch guild or channels
      expect(mockGuildManager.getRole).not.toHaveBeenCalled()
      expect(bot.guilds.fetch).not.toHaveBeenCalled()
    })

    it("should work normally when verified role is not configured", async () => {
      const mockQueue = {
        id: "queue-123",
        isLocked: false,
        name: "test-queue",
        waitingRoomId: "waiting-room-123",
      }
      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)

      // Mock update
      const whereUpdateMock = vi.fn().mockResolvedValue([])
      const setMock = vi.fn().mockReturnValue({ where: whereUpdateMock });
      (db.update as any).mockReturnValue({ set: setMock })

      // Mock GuildManager to return null (no verified role)
      mockGuildManager.getRole.mockResolvedValue(null)

      await queueManager.setQueueLockState("guild-123", "test-queue", true)

      expect(db.update).toHaveBeenCalledWith(queues)
      expect(setMock).toHaveBeenCalledWith({ isLocked: true })
      expect(mockGuildManager.getRole).toHaveBeenCalledWith("guild-123", InternalRole.Verified)
      // Should not try to fetch guild or channels since no verified role
      expect(bot.guilds.fetch).not.toHaveBeenCalled()
    })

    it("should not throw if waiting room permission update fails", async () => {
      const mockQueue = {
        id: "queue-123",
        isLocked: false,
        name: "test-queue",
        waitingRoomId: "waiting-room-123",
      }
      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)

      // Mock update
      const whereUpdateMock = vi.fn().mockResolvedValue([])
      const setMock = vi.fn().mockReturnValue({ where: whereUpdateMock });
      (db.update as any).mockReturnValue({ set: setMock })

      // Mock GuildManager to return verified role
      mockGuildManager.getRole.mockResolvedValue("verified-role-123")

      // Mock Discord to throw error
      const mockGuildsFetch = vi.fn().mockRejectedValue(new Error("Guild fetch failed"));
      (bot.guilds.fetch as any) = mockGuildsFetch

      // Should not throw
      await expect(queueManager.setQueueLockState("guild-123", "test-queue", true))
        .resolves.not.toThrow()

      // Queue should still be locked in database
      expect(db.update).toHaveBeenCalledWith(queues)
      expect(setMock).toHaveBeenCalledWith({ isLocked: true })
    })

    it("should skip permission update if channel is not voice-based", async () => {
      const mockQueue = {
        id: "queue-123",
        isLocked: false,
        name: "test-queue",
        waitingRoomId: "waiting-room-123",
      }
      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)

      // Mock update
      const whereUpdateMock = vi.fn().mockResolvedValue([])
      const setMock = vi.fn().mockReturnValue({ where: whereUpdateMock });
      (db.update as any).mockReturnValue({ set: setMock })

      // Mock GuildManager to return verified role
      mockGuildManager.getRole.mockResolvedValue("verified-role-123")

      // Mock Discord channel that is not voice-based
      const mockPermissionOverwrites = {
        edit: vi.fn(),
      }
      const mockChannel = {
        isVoiceBased: () => false,
        permissionOverwrites: mockPermissionOverwrites,
      }
      const mockGuild = {
        channels: {
          fetch: vi.fn().mockResolvedValue(mockChannel),
        },
      };
      (bot.guilds.fetch as any).mockResolvedValue(mockGuild)

      await queueManager.setQueueLockState("guild-123", "test-queue", true)

      // Should not try to edit permissions
      expect(mockPermissionOverwrites.edit).not.toHaveBeenCalled()
    })
  })
  describe("Scheduling", () => {
    it("should add a schedule", async () => {
      const mockQueue = { id: "queue-123", guildId: "guild-123", name: "test-queue" }
      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)

      const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: vi.fn().mockResolvedValue([]) })
        ; (db.insert as any).mockReturnValue({ values: valuesMock })

      await queueManager.addSchedule("guild-123", "test-queue", 1, "08:00", "20:00")

      expect(db.insert).toHaveBeenCalledWith(queueSchedules)
      expect(valuesMock).toHaveBeenCalledWith({
        queueId: "queue-123",
        dayOfWeek: 1,
        startTime: "08:00",
        endTime: "20:00",
      })
    })

    it("should remove a schedule", async () => {
      const mockQueue = { id: "queue-123", guildId: "guild-123", name: "test-queue" }
      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)

      const whereMock = vi.fn().mockResolvedValue([])
        ; (db.delete as any).mockReturnValue({ where: whereMock })

      await queueManager.removeSchedule("guild-123", "test-queue", 1)

      expect(db.delete).toHaveBeenCalledWith(queueSchedules)
    })

    it("should set schedule shift", async () => {
      const mockQueue = { id: "queue-123", guildId: "guild-123", name: "test-queue" }
      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)

      const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) })
        ; (db.update as any).mockReturnValue({ set: setMock })

      await queueManager.setScheduleShift("guild-123", "test-queue", 10)

      expect(db.update).toHaveBeenCalledWith(queues)
      expect(setMock).toHaveBeenCalledWith({ scheduleShiftMinutes: 10 })
    })

    it("should set schedule enabled", async () => {
      const mockQueue = { id: "queue-123", guildId: "guild-123", name: "test-queue" }
      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)

      const setMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) })
        ; (db.update as any).mockReturnValue({ set: setMock })

      await queueManager.setScheduleEnabled("guild-123", "test-queue", true)

      expect(db.update).toHaveBeenCalledWith(queues)
      expect(setMock).toHaveBeenCalledWith({ scheduleEnabled: true })
    })

    it("should check schedules - unlock if within time", async () => {
      const mockQueue = {
        id: "queue-123",
        guildId: "guild-123",
        name: "test-queue",
        scheduleEnabled: true,
        isLocked: true,
        scheduleShiftMinutes: 0,
      }

      // Mock list of scheduled queues
      const fromMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([mockQueue]) })
        ; (db.select as any).mockReturnValueOnce({ from: fromMock })

      // Mock specific schedule fetch
      // Assuming today is Monday (1) 12:00
      vi.useFakeTimers()
      const date = new Date(2023, 0, 2, 12, 0) // Mon Jan 02 2023 12:00:00
      vi.setSystemTime(date)

      const mockSchedule = { startTime: "08:00", endTime: "20:00" }
      const fromScheduleMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([mockSchedule]) })
        ; (db.select as any).mockReturnValueOnce({ from: fromScheduleMock }) // For the loop

      const setLockSpy = vi.spyOn(queueManager, "setQueueLockState").mockResolvedValue(undefined)
      // Mock getQueueByName for setQueueLockState
      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)
      // Mock db update for setQueueLockState
      ; (db.update as any).mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn() }) })

      await queueManager.checkSchedules()

      expect(setLockSpy).toHaveBeenCalledWith("guild-123", "test-queue", false)

      vi.useRealTimers()
    })

    it("should check schedules - lock if outside time", async () => {
      const mockQueue = {
        id: "queue-123",
        guildId: "guild-123",
        name: "test-queue",
        scheduleEnabled: true,
        isLocked: false,
        scheduleShiftMinutes: 0,
      }

      const fromMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([mockQueue]) })
        ; (db.select as any).mockReturnValueOnce({ from: fromMock })

      vi.useFakeTimers()
      const date = new Date(2023, 0, 2, 22, 0) // Mon Jan 02 2023 22:00:00
      vi.setSystemTime(date)

      const mockSchedule = { startTime: "08:00", endTime: "20:00" }
      const fromScheduleMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([mockSchedule]) })
        ; (db.select as any).mockReturnValueOnce({ from: fromScheduleMock })

      const setLockSpy = vi.spyOn(queueManager, "setQueueLockState").mockResolvedValue(undefined)
      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)
      ; (db.update as any).mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn() }) })

      await queueManager.checkSchedules()

      expect(setLockSpy).toHaveBeenCalledWith("guild-123", "test-queue", true)

      vi.useRealTimers()
    })

    it("should check schedules - use shift (open earlier)", async () => {
      const mockQueue = {
        id: "queue-123",
        guildId: "guild-123",
        name: "test-queue",
        scheduleEnabled: true,
        isLocked: true,
        scheduleShiftMinutes: 10, // Shift 10 mins earlier
      }

      const fromMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([mockQueue]) })
        ; (db.select as any).mockReturnValueOnce({ from: fromMock })

      vi.useFakeTimers()
      const date = new Date(2023, 0, 2, 7, 55) // 7:55, normally closed (opens 8:00), but with shift 10m -> 7:50 open
      vi.setSystemTime(date)

      const mockSchedule = { startTime: "08:00", endTime: "20:00" }
      const fromScheduleMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([mockSchedule]) })
        ; (db.select as any).mockReturnValueOnce({ from: fromScheduleMock })

      const setLockSpy = vi.spyOn(queueManager, "setQueueLockState").mockResolvedValue(undefined)
      vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)
      ; (db.update as any).mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn() }) })

      await queueManager.checkSchedules()

      expect(setLockSpy).toHaveBeenCalledWith("guild-123", "test-queue", false)

      vi.useRealTimers()
    })
  })

  describe("Validation Methods", () => {
    describe("parseDayOfWeek", () => {
      it("should parse valid days correctly", () => {
        expect(queueManager.parseDayOfWeek("Sunday")).toBe(0)
        expect(queueManager.parseDayOfWeek("Monday")).toBe(1)
        expect(queueManager.parseDayOfWeek("Tuesday")).toBe(2)
        expect(queueManager.parseDayOfWeek("Wednesday")).toBe(3)
        expect(queueManager.parseDayOfWeek("Thursday")).toBe(4)
        expect(queueManager.parseDayOfWeek("Friday")).toBe(5)
        expect(queueManager.parseDayOfWeek("Saturday")).toBe(6)
      })

      it("should be case-insensitive", () => {
        expect(queueManager.parseDayOfWeek("monday")).toBe(1)
        expect(queueManager.parseDayOfWeek("MONDAY")).toBe(1)
        expect(queueManager.parseDayOfWeek("MoNdAy")).toBe(1)
      })

      it("should throw InvalidQueueScheduleDayError for invalid day", async () => {
        expect(() => queueManager.parseDayOfWeek("Funday")).toThrow(InvalidQueueScheduleDayError)
        expect(() => queueManager.parseDayOfWeek("Funday")).toThrow("Invalid day of week: \"Funday\"")
      })
    })

    describe("validateTimeFormat", () => {
      it("should accept valid time formats", () => {
        expect(() => queueManager.validateTimeFormat("00:00")).not.toThrow()
        expect(() => queueManager.validateTimeFormat("12:30")).not.toThrow()
        expect(() => queueManager.validateTimeFormat("23:59")).not.toThrow()
        expect(() => queueManager.validateTimeFormat("9:15")).not.toThrow()
      })

      it("should throw InvalidTimeFormatError for invalid formats", () => {
        expect(() => queueManager.validateTimeFormat("25:00")).toThrow(InvalidTimeFormatError)
        expect(() => queueManager.validateTimeFormat("12:60")).toThrow(InvalidTimeFormatError)
        expect(() => queueManager.validateTimeFormat("12")).toThrow(InvalidTimeFormatError)
        expect(() => queueManager.validateTimeFormat("12:")).toThrow(InvalidTimeFormatError)
        expect(() => queueManager.validateTimeFormat("12:3")).toThrow(InvalidTimeFormatError)
        expect(() => queueManager.validateTimeFormat("1230")).toThrow(InvalidTimeFormatError)
      })
    })

    describe("validateTimeRange", () => {
      it("should accept valid time ranges", () => {
        expect(() => queueManager.validateTimeRange("08:00", "17:00")).not.toThrow()
        expect(() => queueManager.validateTimeRange("00:00", "23:59")).not.toThrow()
        expect(() => queueManager.validateTimeRange("09:00", "09:01")).not.toThrow()
      })

      it("should throw InvalidTimeRangeError when start equals end", () => {
        expect(() => queueManager.validateTimeRange("12:00", "12:00")).toThrow(InvalidTimeRangeError)
      })

      it("should throw InvalidTimeRangeError when start is after end", () => {
        expect(() => queueManager.validateTimeRange("17:00", "08:00")).toThrow(InvalidTimeRangeError)
        expect(() => queueManager.validateTimeRange("12:30", "12:29")).toThrow(InvalidTimeRangeError)
      })
    })
  })

  describe("Helper Methods", () => {
    describe("getQueueListEmbed", () => {
      it("should return empty queue embed when queue has no members", async () => {
        const mockQueue = { id: "queue-123", name: "test-queue" }
        vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)
        vi.spyOn(queueManager, "getQueueMembers").mockResolvedValue([])

        const embed = await queueManager.getQueueListEmbed("guild-123", "test-queue")

        expect(embed.data.title).toBe("Queue: test-queue")
        expect(embed.data.description).toBe("The queue is empty.")
        expect(embed.data.footer?.text).toBe("Total: 0")
      })

      it("should return formatted list embed with members", async () => {
        const mockQueue = { id: "queue-123", name: "test-queue" }
        const mockMembers = [
          { userId: "user-1" },
          { userId: "user-2" },
          { userId: "user-3" },
        ]
        vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)
        vi.spyOn(queueManager, "getQueueMembers").mockResolvedValue(mockMembers as any)

        const embed = await queueManager.getQueueListEmbed("guild-123", "test-queue")

        expect(embed.data.title).toBe("Queue: test-queue")
        expect(embed.data.description).toContain("1. <@user-1>")
        expect(embed.data.description).toContain("2. <@user-2>")
        expect(embed.data.description).toContain("3. <@user-3>")
        expect(embed.data.footer?.text).toBe("Showing top 3 members")
      })

      it("should respect limit parameter", async () => {
        const mockQueue = { id: "queue-123", name: "test-queue" }
        const mockMembers = [{ userId: "user-1" }, { userId: "user-2" }]
        vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)
        vi.spyOn(queueManager, "getQueueMembers").mockResolvedValue(mockMembers as any)

        await queueManager.getQueueListEmbed("guild-123", "test-queue", 10)

        expect(queueManager.getQueueMembers).toHaveBeenCalledWith("guild-123", "test-queue", 10)
      })

      it("should throw QueueNotFoundError when queue doesn't exist", async () => {
        vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(null as any)

        await expect(queueManager.getQueueListEmbed("guild-123", "nonexistent"))
          .rejects.toThrow("Queue \"nonexistent\" not found")
      })
    })

    describe("getQueueSummaryEmbed", () => {
      it("should return summary embed with stats", async () => {
        const mockQueue = {
          id: "queue-123",
          name: "test-queue",
          description: "Test queue description",
          isLocked: false,
        }
        const mockQueueStats = {
          ...mockQueue,
          memberCount: 5,
          sessionCount: 2,
        }
        vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)
        vi.spyOn(queueManager, "listQueues").mockResolvedValue([mockQueueStats] as any)

        const embed = await queueManager.getQueueSummaryEmbed("guild-123", "test-queue")

        expect(embed.data.title).toBe("Queue Summary: test-queue")
        expect(embed.data.description).toBe("Test queue description")
        expect(embed.data.fields).toHaveLength(3)
        expect(embed.data.fields?.[0]).toEqual({ name: "Students in Queue", value: "5", inline: true })
        expect(embed.data.fields?.[1]).toEqual({ name: "Active Sessions", value: "2", inline: true })
        expect(embed.data.fields?.[2]).toEqual({ name: "Locked", value: "No", inline: true })
        expect(embed.data.footer?.text).toBe("Queue ID: queue-123")
      })

      it("should show 'No description' when description is null", async () => {
        const mockQueue = { id: "queue-123", name: "test-queue", description: null, isLocked: true }
        const mockQueueStats = { ...mockQueue, memberCount: 0, sessionCount: 0 }
        vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(mockQueue as any)
        vi.spyOn(queueManager, "listQueues").mockResolvedValue([mockQueueStats] as any)

        const embed = await queueManager.getQueueSummaryEmbed("guild-123", "test-queue")

        expect(embed.data.description).toBe("No description.")
        expect(embed.data.fields?.[2]).toEqual({ name: "Locked", value: "Yes", inline: true })
      })

      it("should throw QueueNotFoundError when queue doesn't exist", async () => {
        vi.spyOn(queueManager, "getQueueByName").mockResolvedValue(null as any)

        await expect(queueManager.getQueueSummaryEmbed("guild-123", "nonexistent"))
          .rejects.toThrow("Queue \"nonexistent\" not found")
      })
    })

    describe("logToPublicChannel", () => {
      it("should log to public channel when publicLogChannelId is set", async () => {
        const mockQueue = { publicLogChannelId: "channel-123", name: "test-queue" }
        const mockChannel = {
          type: 0, // GuildText (ChannelType.GuildText)
          send: vi.fn().mockResolvedValue({}),
        };
        (bot.channels.fetch as any).mockResolvedValue(mockChannel)

        // Access private method via any cast for testing
        await (queueManager as any).logToPublicChannel(mockQueue, "Test message")

        expect(bot.channels.fetch).toHaveBeenCalledWith("channel-123")
        expect(mockChannel.send).toHaveBeenCalled()
        const call = mockChannel.send.mock.calls[0][0]
        expect(call.embeds[0].data.title).toBe("Sprechstundensystem: test-queue")
        expect(call.embeds[0].data.description).toBe("Test message")
      })

      it("should do nothing when publicLogChannelId is null", async () => {
        const mockQueue = { publicLogChannelId: null, name: "test-queue" }

        await (queueManager as any).logToPublicChannel(mockQueue, "Test message")

        expect(bot.channels.fetch).not.toHaveBeenCalled()
      })

      it("should handle channel fetch failure gracefully", async () => {
        const mockQueue = { publicLogChannelId: "channel-123", name: "test-queue" };
        (bot.channels.fetch as any).mockRejectedValue(new Error("Channel not found"))

        // Should not throw
        await expect((queueManager as any).logToPublicChannel(mockQueue, "Test")).resolves.not.toThrow()
      })

      it("should skip when channel is not a text channel", async () => {
        const mockQueue = { publicLogChannelId: "channel-123", name: "test-queue" }
        const mockChannel = {
          type: 2, // GuildVoice
          send: vi.fn(),
        };
        (bot.channels.fetch as any).mockResolvedValue(mockChannel)

        await (queueManager as any).logToPublicChannel(mockQueue, "Test message")

        expect(mockChannel.send).not.toHaveBeenCalled()
      })
    })

    describe("logToChannel (private logging)", () => {
      it("should log to private channel with stats", async () => {
        const mockQueue = {
          id: "queue-123",
          privateLogChannelId: "channel-456",
          name: "test-queue",
          guildId: "guild-123",
        }
        const mockChannel = {
          type: 0, // GuildText
          send: vi.fn().mockResolvedValue({}),
        };
        (bot.channels.fetch as any).mockResolvedValue(mockChannel)

        // Mock DB queries for stats
        const memberCountResult = [{ count: 3 }]
        const sessionCountResult = [{ count: 1 }]
        const whereMock = vi.fn()
          .mockResolvedValueOnce(memberCountResult)
          .mockResolvedValueOnce(sessionCountResult)
        const fromMock = vi.fn().mockReturnValue({ where: whereMock });
        (db.select as any).mockReturnValue({ from: fromMock })

        mockGuildManager.getRole.mockResolvedValue(null)

        await (queueManager as any).logToChannel(mockQueue, "Test update")

        expect(bot.channels.fetch).toHaveBeenCalledWith("channel-456")
        expect(mockChannel.send).toHaveBeenCalled()
        const call = mockChannel.send.mock.calls[0][0]
        expect(call.embeds[0].data.title).toBe("Queue Update: test-queue")
        expect(call.embeds[0].data.description).toBe("Test update")
        expect(call.embeds[0].data.fields).toHaveLength(2)
      })

      it("should do nothing when privateLogChannelId is null", async () => {
        const mockQueue = { privateLogChannelId: null, name: "test-queue" }

        await (queueManager as any).logToChannel(mockQueue, "Test message")

        expect(bot.channels.fetch).not.toHaveBeenCalled()
      })

      it("should handle channel fetch failure gracefully", async () => {
        const mockQueue = {
          id: "queue-123",
          privateLogChannelId: "channel-456",
          name: "test-queue",
        };
        (bot.channels.fetch as any).mockRejectedValue(new Error("Channel not found"))

        await expect((queueManager as any).logToChannel(mockQueue, "Test")).resolves.not.toThrow()
      })

      it("should handle DB query failure gracefully", async () => {
        const mockQueue = {
          id: "queue-123",
          privateLogChannelId: "channel-456",
          name: "test-queue",
          guildId: "guild-123",
        }
        const mockChannel = { type: 4, send: vi.fn() };
        (bot.channels.fetch as any).mockResolvedValue(mockChannel);
        (db.select as any).mockImplementation(() => {
          throw new Error("DB error")
        })

        await expect((queueManager as any).logToChannel(mockQueue, "Test")).resolves.not.toThrow()
        expect(mockChannel.send).not.toHaveBeenCalled()
      })

      it("should include role mention prefix when active_session role exists", async () => {
        const mockQueue = {
          id: "queue-123",
          privateLogChannelId: "channel-456",
          name: "test-queue",
          guildId: "guild-123",
        }
        const mockChannel = { type: 0, send: vi.fn().mockResolvedValue({}) };
        (bot.channels.fetch as any).mockResolvedValue(mockChannel)

        const memberCountResult = [{ count: 0 }]
        const sessionCountResult = [{ count: 0 }]
        const whereMock = vi.fn()
          .mockResolvedValueOnce(memberCountResult)
          .mockResolvedValueOnce(sessionCountResult)
        const fromMock = vi.fn().mockReturnValue({ where: whereMock });
        (db.select as any).mockReturnValue({ from: fromMock })

        mockGuildManager.getRole.mockResolvedValue("role-789")

        await (queueManager as any).logToChannel(mockQueue, "Test update")

        const call = mockChannel.send.mock.calls[0][0]
        expect(call.content).toBe("<@&role-789> ")
      })
    })
  })
})
