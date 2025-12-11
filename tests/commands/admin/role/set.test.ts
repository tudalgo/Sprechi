import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { AdminRoleSet } from "@commands/admin/role/set"
import { GuildManager } from "@managers/GuildManager"
import { InternalRole } from "@db"
import { CommandInteraction, Role } from "discord.js"
import { mockDeep } from "vitest-mock-extended"

vi.mock("@managers/GuildManager")
vi.mock("@db", () => ({
  InternalRole: {
    Admin: "admin",
    Tutor: "tutor",
    Verified: "verified",
    ActiveSession: "active_session",
  },
}))
vi.mock("@utils/logger")

describe("AdminRoleSet", () => {
  let command: AdminRoleSet
  let mockGuildManager: any
  let mockInteraction: any

  beforeEach(() => {
    mockGuildManager = mockDeep<GuildManager>()
    command = new AdminRoleSet(mockGuildManager)
    mockInteraction = mockDeep<CommandInteraction>()
    mockInteraction.guild = { id: "guild-1" }
    mockInteraction.reply = vi.fn()
  })

  it("should set role mapping", async () => {
    const mockRole = { id: "role-1", name: "Role 1", toString: () => "<@&role-1>" } as unknown as Role

    await command.set(InternalRole.Admin, mockRole, mockInteraction)

    expect(mockGuildManager.setRole).toHaveBeenCalledWith("guild-1", InternalRole.Admin, "role-1")
    expect(mockInteraction.reply).toHaveBeenCalled()
  })

  it("should handle errors", async () => {
    mockGuildManager.setRole.mockRejectedValue(new Error("test error"))
    await command.set(InternalRole.Admin, {} as Role, mockInteraction)
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([expect.objectContaining({ data: expect.objectContaining({ title: "Error", description: "An error occurred while setting the role mapping." }) })]),
    }))
  })

  it("should set Tutor role mapping", async () => {
    const mockRole = { id: "tutor-role-1", name: "Tutor Role", toString: () => "<@&tutor-role-1>" } as unknown as Role

    await command.set(InternalRole.Tutor, mockRole, mockInteraction)

    expect(mockGuildManager.setRole).toHaveBeenCalledWith("guild-1", InternalRole.Tutor, "tutor-role-1")
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([expect.objectContaining({ data: expect.objectContaining({ title: "Role Mapping Updated" }) })]),
    }))
  })

  it("should set Verified role mapping", async () => {
    const mockRole = { id: "verified-role-1", name: "Verified Role", toString: () => "<@&verified-role-1>" } as unknown as Role

    await command.set(InternalRole.Verified, mockRole, mockInteraction)

    expect(mockGuildManager.setRole).toHaveBeenCalledWith("guild-1", InternalRole.Verified, "verified-role-1")
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([expect.objectContaining({ data: expect.objectContaining({ title: "Role Mapping Updated" }) })]),
    }))
  })

  it("should set ActiveSession role mapping", async () => {
    const mockRole = { id: "session-role-1", name: "Active Session Role", toString: () => "<@&session-role-1>" } as unknown as Role

    await command.set(InternalRole.ActiveSession, mockRole, mockInteraction)

    expect(mockGuildManager.setRole).toHaveBeenCalledWith("guild-1", InternalRole.ActiveSession, "session-role-1")
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([expect.objectContaining({ data: expect.objectContaining({ title: "Role Mapping Updated" }) })]),
    }))
  })

  it("should handle database failures when setting role", async () => {
    const mockRole = { id: "role-1", name: "Role 1", toString: () => "<@&role-1>" } as unknown as Role
    mockGuildManager.setRole.mockRejectedValue(new Error("Database connection failed"))

    await command.set(InternalRole.Admin, mockRole, mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([expect.objectContaining({
        data: expect.objectContaining({
          title: "Error",
          description: "An error occurred while setting the role mapping.",
        }),
      })]),
    }))
  })
})
