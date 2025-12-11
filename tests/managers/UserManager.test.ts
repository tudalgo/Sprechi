import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { UserManager } from "@managers/UserManager"
import { GuildManager } from "@managers/GuildManager"
import { GuildMember, Role, Guild, User } from "discord.js"
import { mockDeep } from "vitest-mock-extended"
import db, { InternalRole } from "@db"
import {
  InvalidTokenError,
  TokenAlreadyUsedError,
  WrongServerError,
  UserNotInGuildError,
  UserNotVerifiedError,
} from "@errors/UserErrors"

// Mock db
vi.mock("@db", () => ({
  default: {
    insert: vi.fn(),
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  },
  InternalRole: {
    Admin: "admin",
    Tutor: "tutor",
    Verified: "verified",
    ActiveSession: "active_session",
  },
  users: {
    discordId: "discord_id",
    guildId: "guild_id",
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

// Mock token utils
vi.mock("@utils/token", () => ({
  decryptTokenString: vi.fn(),
  encryptText: vi.fn(),
}))

describe("UserManager", () => {
  let userManager: UserManager
  let mockGuildManager: any
  let mockMember: any
  let mockGuild: any
  let mockUser: any

  beforeEach(() => {
    // Setup mocks
    mockGuildManager = mockDeep<GuildManager>()
    userManager = new UserManager(mockGuildManager)

    mockUser = mockDeep<User>()
    mockUser.id = "user-123"
    mockUser.username = "testuser"

    mockGuild = mockDeep<Guild>()
    mockGuild.id = "guild-123"
    mockGuild.name = "Test Guild"
    mockGuild.roles.cache.get = vi.fn()

    mockMember = mockDeep<GuildMember>()
    mockMember.user = mockUser
    mockMember.guild = mockGuild
    mockMember.roles.add = vi.fn()

    vi.clearAllMocks()
  })

  describe("verifyUser", () => {
    it("should verify user with valid token", async () => {
      const { decryptTokenString } = await import("@utils/token")
      const tokenData = {
        serverId: "guild-123",
        versionId: "01",
        tuId: "tu123",
        moodleId: "moodle456",
        roles: [InternalRole.Verified],
      };

      (decryptTokenString as any).mockReturnValue(tokenData);
      (db.query.users.findFirst as any).mockResolvedValue(null)

      const mockRole = mockDeep<Role>()
      mockRole.name = "Verified";
      (mockGuild.roles.cache.get as any).mockReturnValue(mockRole);
      (mockGuildManager.getRole as any).mockResolvedValue("role-123")

      const onConflictDoUpdateMock = vi.fn().mockResolvedValue([])
      const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictDoUpdateMock });
      (db.insert as any).mockReturnValue({ values: valuesMock })

      const roleNames = await userManager.verifyUser(mockMember, "encrypted_token")

      expect(roleNames).toEqual(["Verified"])
      expect(mockMember.roles.add).toHaveBeenCalledWith([mockRole])
    })

    it("should throw InvalidTokenError for invalid token", async () => {
      const { decryptTokenString } = await import("@utils/token");
      (decryptTokenString as any).mockReturnValue(null)

      await expect(userManager.verifyUser(mockMember, "invalid_token"))
        .rejects.toThrow(InvalidTokenError)
    })

    it("should throw WrongServerError for wrong server", async () => {
      const { decryptTokenString } = await import("@utils/token")
      const tokenData = {
        serverId: "different-guild",
        versionId: "01",
        tuId: "tu123",
        moodleId: "moodle456",
        roles: [InternalRole.Verified],
      };
      (decryptTokenString as any).mockReturnValue(tokenData)

      await expect(userManager.verifyUser(mockMember, "encrypted_token"))
        .rejects.toThrow(WrongServerError)
    })

    it("should throw TokenAlreadyUsedError when token used by another user", async () => {
      const { decryptTokenString } = await import("@utils/token")
      const tokenData = {
        serverId: "guild-123",
        versionId: "01",
        tuId: "tu123",
        moodleId: "moodle456",
        roles: [InternalRole.Verified],
      };
      (decryptTokenString as any).mockReturnValue(tokenData);
      (db.query.users.findFirst as any).mockResolvedValue({
        discordId: "different-user",
        moodleId: "moodle456",
      })

      await expect(userManager.verifyUser(mockMember, "encrypted_token"))
        .rejects.toThrow(TokenAlreadyUsedError)
    })

    it("should allow same user to re-verify and preserve original verifiedAt", async () => {
      const { decryptTokenString } = await import("@utils/token")
      const originalVerifiedAt = new Date("2024-01-01T00:00:00Z")
      const tokenData = {
        serverId: "guild-123",
        versionId: "01",
        tuId: "tu123",
        moodleId: "moodle456",
        roles: [InternalRole.Verified],
      };

      (decryptTokenString as any).mockReturnValue(tokenData);

      // First call checks for existing user (checkTokenUsage)
      // Second call checks if it's a re-verification
      // Third call is in saveUserData to get the existing verifiedAt
      (db.query.users.findFirst as any)
        .mockResolvedValueOnce({
          discordId: "user-123",
          moodleId: "moodle456",
        })
        .mockResolvedValueOnce({
          discordId: "user-123",
          moodleId: "moodle456",
          verifiedAt: originalVerifiedAt,
        })
        .mockResolvedValueOnce({
          discordId: "user-123",
          moodleId: "moodle456",
          verifiedAt: originalVerifiedAt,
        })

      const mockRole = mockDeep<Role>()
      mockRole.name = "Verified";
      (mockGuild.roles.cache.get as any).mockReturnValue(mockRole);
      (mockGuildManager.getRole as any).mockResolvedValue("role-123")

      const onConflictDoUpdateMock = vi.fn().mockResolvedValue([])
      const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictDoUpdateMock });
      (db.insert as any).mockReturnValue({ values: valuesMock })

      const roleNames = await userManager.verifyUser(mockMember, "encrypted_token")

      expect(roleNames).toEqual(["Verified"])

      // Verify that onConflictDoUpdate was called with the preserved verifiedAt
      expect(onConflictDoUpdateMock).toHaveBeenCalled()
      const updateCall = onConflictDoUpdateMock.mock.calls[0][0]
      expect(updateCall.set.verifiedAt).toEqual(originalVerifiedAt)
    })

    it("should assign multiple roles", async () => {
      const { decryptTokenString } = await import("@utils/token")
      const tokenData = {
        serverId: "guild-123",
        versionId: "01",
        tuId: "tu123",
        moodleId: "moodle456",
        roles: [InternalRole.Verified, InternalRole.Tutor],
      };
      (decryptTokenString as any).mockReturnValue(tokenData);
      (db.query.users.findFirst as any).mockResolvedValue(null)

      const mockVerifiedRole = mockDeep<Role>()
      mockVerifiedRole.name = "Verified"
      const mockTutorRole = mockDeep<Role>()
      mockTutorRole.name = "Tutor";

      (mockGuild.roles.cache.get as any)
        .mockReturnValueOnce(mockVerifiedRole)
        .mockReturnValueOnce(mockTutorRole);

      (mockGuildManager.getRole as any)
        .mockResolvedValueOnce("role-verified")
        .mockResolvedValueOnce("role-tutor")

      const onConflictDoUpdateMock = vi.fn().mockResolvedValue([])
      const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictDoUpdateMock });
      (db.insert as any).mockReturnValue({ values: valuesMock })

      const roleNames = await userManager.verifyUser(mockMember, "encrypted_token")

      expect(roleNames).toEqual(["Verified", "Tutor"])
    })
  })

  describe("reapplyRoles", () => {
    it("should reapply saved roles", async () => {
      (db.query.users.findFirst as any).mockResolvedValue({
        discordId: "user-123",
        guildId: "guild-123",
        roles: [InternalRole.Verified, InternalRole.Tutor],
      })

      const mockVerifiedRole = mockDeep<Role>()
      mockVerifiedRole.name = "Verified"
      const mockTutorRole = mockDeep<Role>()
      mockTutorRole.name = "Tutor";

      (mockGuild.roles.cache.get as any)
        .mockReturnValueOnce(mockVerifiedRole)
        .mockReturnValueOnce(mockTutorRole);

      (mockGuildManager.getRole as any)
        .mockResolvedValueOnce("role-verified")
        .mockResolvedValueOnce("role-tutor")

      await userManager.reapplyRoles(mockMember)

      expect(mockMember.roles.add).toHaveBeenCalledWith([mockVerifiedRole, mockTutorRole])
    })

    it("should do nothing if user not verified", async () => {
      (db.query.users.findFirst as any).mockResolvedValue(null)

      await userManager.reapplyRoles(mockMember)

      expect(mockMember.roles.add).not.toHaveBeenCalled()
    })

    it("should do nothing if no roles saved", async () => {
      (db.query.users.findFirst as any).mockResolvedValue({
        discordId: "user-123",
        guildId: "guild-123",
        roles: [],
      })

      await userManager.reapplyRoles(mockMember)

      expect(mockMember.roles.add).not.toHaveBeenCalled()
    })
  })

  describe("getUserData", () => {
    it("should return user data", async () => {
      const userData = {
        discordId: "user-123",
        guildId: "guild-123",
        tuId: "tu123",
        moodleId: "moodle456",
      };
      (db.query.users.findFirst as any).mockResolvedValue(userData)

      const result = await userManager.getUserData(mockMember)

      expect(result).toEqual(userData)
    })

    it("should throw UserNotVerifiedError if user not found", async () => {
      (db.query.users.findFirst as any).mockResolvedValue(null)

      await expect(userManager.getUserData(mockMember))
        .rejects.toThrow(UserNotVerifiedError)
    })
  })

  describe("searchUser", () => {
    it("should search by Discord ID", async () => {
      const userData = {
        discordId: "user-123",
        guildId: "guild-123",
      };
      (db.query.users.findFirst as any).mockResolvedValue(userData)

      const result = await userManager.searchUser("guild-123", "discord", "user-123")

      expect(result).toEqual(userData)
    })

    it("should search by TU ID", async () => {
      const userData = {
        discordId: "user-123",
        guildId: "guild-123",
        tuId: "tu123",
      };
      (db.query.users.findFirst as any).mockResolvedValue(userData)

      const result = await userManager.searchUser("guild-123", "tu", "tu123")

      expect(result).toEqual(userData)
    })

    it("should search by Moodle ID", async () => {
      const userData = {
        discordId: "user-123",
        guildId: "guild-123",
        moodleId: "moodle456",
      };
      (db.query.users.findFirst as any).mockResolvedValue(userData)

      const result = await userManager.searchUser("guild-123", "moodle", "moodle456")

      expect(result).toEqual(userData)
    })

    it("should throw UserNotVerifiedError if user not found", async () => {
      (db.query.users.findFirst as any).mockResolvedValue(null)

      await expect(userManager.searchUser("guild-123", "discord", "user-123"))
        .rejects.toThrow(UserNotVerifiedError)
    })
  })

  describe("checkUserInGuild", () => {
    it("should pass if user is in guild", async () => {
      mockGuild.members.fetch = vi.fn().mockResolvedValue(mockMember)

      await expect(userManager.checkUserInGuild(mockGuild, "user-123"))
        .resolves.toBeUndefined()
    })

    it("should throw UserNotInGuildError if user not in guild", async () => {
      mockGuild.members.fetch = vi.fn().mockRejectedValue(new Error("Not found"))

      await expect(userManager.checkUserInGuild(mockGuild, "user-123"))
        .rejects.toThrow(UserNotInGuildError)
    })
  })

  describe("role handling edge cases", () => {
    it("should skip adding role when GuildManager.getRole returns null", async () => {
      const { decryptTokenString } = await import("@utils/token")
      const tokenData = {
        serverId: "guild-123",
        versionId: "01",
        tuId: "tu123",
        moodleId: "moodle456",
        roles: [InternalRole.Verified],
      };

      (decryptTokenString as any).mockReturnValue(tokenData);
      (db.query.users.findFirst as any).mockResolvedValue(null);

      // Return null for role mapping
      (mockGuildManager.getRole as any).mockResolvedValue(null)

      const onConflictDoUpdateMock = vi.fn().mockResolvedValue([])
      const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictDoUpdateMock });
      (db.insert as any).mockReturnValue({ values: valuesMock })

      const roleNames = await userManager.verifyUser(mockMember, "encrypted_token")

      // Should return empty as role was skipped
      expect(roleNames).toEqual([])
      // roles.add is not called when rolesToAssign is empty (line 138-140 in implementation)
    })

    it("should propagate error when decryptTokenString throws", async () => {
      const { decryptTokenString } = await import("@utils/token");
      (decryptTokenString as any).mockImplementation(() => {
        throw new Error("Decryption failed")
      })

      // The implementation doesn't catch errors from decryptTokenString (line 32), so they propagate
      await expect(userManager.verifyUser(mockMember, "encrypted_token"))
        .rejects.toThrow("Decryption failed")
    })
  })
})
