import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { GuildManager } from "@managers/GuildManager"
import { Guild, Collection } from "discord.js"
import db, { guilds, roleMappings, InternalRole } from "@db"

// Mock bot - use factory function to avoid hoisting issues
vi.mock("@/bot", () => ({
  bot: {
    guilds: {
      cache: new Collection(),
    },
  },
}))

// Mock db
vi.mock("@db", () => ({
  default: {
    insert: vi.fn(),
    select: vi.fn(),
    query: {
      roleMappings: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
    },
  },
  guilds: {
    id: "id",
  },
  roleMappings: {
    guildId: "guild_id",
    roleType: "role_type",
  },
  InternalRole: {
    Admin: "admin",
    Tutor: "tutor",
    Verified: "verified",
    ActiveSession: "active_session",
  },
}))

// Mock logger
vi.mock("@utils/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe("GuildManager", () => {
  let guildManager: GuildManager

  beforeEach(async () => {
    guildManager = new GuildManager()
    // Import bot after mocks are set up
    const { bot } = await import("@/bot")
    bot.guilds.cache.clear()
    vi.clearAllMocks()
  })

  describe("syncAllGuilds", () => {
    it("should sync guilds successfully", async () => {
      const { bot } = await import("@/bot")
      const mockGuild = { id: "guild-123", name: "Test Guild", memberCount: 10 };
      (bot.guilds.cache as any).set(mockGuild.id, mockGuild)

      // Mock db.select (existing guilds)
      const fromMock = vi.fn().mockResolvedValue([]);
      (db.select as any).mockReturnValue({ from: fromMock })

      // Mock db.insert
      const onConflictDoNothingMock = vi.fn().mockResolvedValue([])
      const valuesMock = vi.fn().mockReturnValue({ onConflictDoNothing: onConflictDoNothingMock });
      (db.insert as any).mockReturnValue({ values: valuesMock })

      await guildManager.syncAllGuilds()

      expect(db.insert).toHaveBeenCalledWith(guilds)
      expect(valuesMock).toHaveBeenCalledWith({
        id: mockGuild.id,
        name: mockGuild.name,
        memberCount: mockGuild.memberCount,
      })
    })

    it("should not add existing guilds", async () => {
      const { bot } = await import("@/bot")
      const mockGuild = { id: "guild-123", name: "Test Guild", memberCount: 10 };
      (bot.guilds.cache as any).set(mockGuild.id, mockGuild)

      // Mock db.select (existing guilds)
      const fromMock = vi.fn().mockResolvedValue([{ id: "guild-123" }]);
      (db.select as any).mockReturnValue({ from: fromMock })

      await guildManager.syncAllGuilds()

      expect(db.insert).not.toHaveBeenCalled()
    })
  })

  describe("addGuild", () => {
    it("should add guild successfully", async () => {
      const mockGuild = { id: "guild-123", name: "Test Guild", memberCount: 10 } as unknown as Guild

      // Mock db.insert
      const onConflictDoNothingMock = vi.fn().mockResolvedValue([])
      const valuesMock = vi.fn().mockReturnValue({ onConflictDoNothing: onConflictDoNothingMock });
      (db.insert as any).mockReturnValue({ values: valuesMock })

      await guildManager.addGuild(mockGuild)

      expect(db.insert).toHaveBeenCalledWith(guilds)
      expect(valuesMock).toHaveBeenCalledWith({
        id: mockGuild.id,
        name: mockGuild.name,
        memberCount: mockGuild.memberCount,
      })
    })

    it("should propagate errors when db.insert fails", async () => {
      const mockGuild = { id: "guild-123", name: "Test Guild", memberCount: 10 } as unknown as Guild
      const dbError = new Error("Database connection failed")

      // Mock db.insert to throw
      const onConflictDoNothingMock = vi.fn().mockRejectedValue(dbError)
      const valuesMock = vi.fn().mockReturnValue({ onConflictDoNothing: onConflictDoNothingMock });
      (db.insert as any).mockReturnValue({ values: valuesMock })

      // Should propagate the error
      await expect(guildManager.addGuild(mockGuild)).rejects.toThrow("Database connection failed")
    })
  })

  describe("setRole", () => {
    it("should set role mapping successfully", async () => {
      const guildId = "guild-123"
      const roleId = "role-456"
      const type = InternalRole.Admin

      const onConflictDoUpdateMock = vi.fn().mockResolvedValue([])
      const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictDoUpdateMock });
      (db.insert as any).mockReturnValue({ values: valuesMock })

      await guildManager.setRole(guildId, type, roleId)

      expect(db.insert).toHaveBeenCalledWith(roleMappings)
      expect(valuesMock).toHaveBeenCalledWith({
        guildId,
        roleType: type,
        roleId,
      })
      expect(onConflictDoUpdateMock).toHaveBeenCalled()
    })
  })

  describe("getRole", () => {
    it("should return role ID when mapping exists", async () => {
      const guildId = "guild-123"
      const type = InternalRole.Admin
      const expectedRoleId = "role-456";

      (db.query.roleMappings.findFirst as any).mockResolvedValue({ roleId: expectedRoleId })

      const result = await guildManager.getRole(guildId, type)

      expect(result).toBe(expectedRoleId)
      expect(db.query.roleMappings.findFirst).toHaveBeenCalled()
    })

    it("should return null when mapping does not exist", async () => {
      const guildId = "guild-123"
      const type = InternalRole.Admin;

      (db.query.roleMappings.findFirst as any).mockResolvedValue(undefined)

      const result = await guildManager.getRole(guildId, type)

      expect(result).toBeNull()
    })
  })

  describe("getAllRoles", () => {
    it("should return all role mappings for guild", async () => {
      const guildId = "guild-123"
      const mockMappings = [
        { roleType: InternalRole.Admin, roleId: "role-1" },
        { roleType: InternalRole.Tutor, roleId: "role-2" },
      ];

      (db.query.roleMappings.findMany as any).mockResolvedValue(mockMappings)

      const result = await guildManager.getAllRoles(guildId)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({ type: InternalRole.Admin, roleId: "role-1" })
      expect(result[1]).toEqual({ type: InternalRole.Tutor, roleId: "role-2" })
      expect(db.query.roleMappings.findMany).toHaveBeenCalled()
    })
  })
})
