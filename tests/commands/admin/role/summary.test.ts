import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { AdminRoleSummary } from "@commands/admin/role/summary"
import { GuildManager } from "@managers/GuildManager"
import { InternalRole } from "@db"
import { CommandInteraction } from "discord.js"
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

describe("AdminRoleSummary", () => {
  let command: AdminRoleSummary
  let mockGuildManager: any
  let mockInteraction: any

  beforeEach(() => {
    mockGuildManager = mockDeep<GuildManager>()
    command = new AdminRoleSummary(mockGuildManager)
    mockInteraction = mockDeep<CommandInteraction>()
    mockInteraction.guild = { id: "guild-1" }
    mockInteraction.reply = vi.fn()
  })

  it("should show summary", async () => {
    mockGuildManager.getAllRoles.mockResolvedValue([
      { type: InternalRole.Admin, roleId: "role-1" },
    ])

    await command.summary(mockInteraction)

    expect(mockGuildManager.getAllRoles).toHaveBeenCalledWith("guild-1")
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([expect.objectContaining({
        data: expect.objectContaining({
          // Check for substrings in description is hard with objectContaining on deep properties if it's strictly equal. Use callback?
        }),
      })]),
    }))

    // Let's inspect the call arguments
    const replyCall = mockInteraction.reply.mock.calls[0][0]
    const description = replyCall.embeds[0].data.description
    expect(description).toContain("**admin**: <@&role-1>")
    expect(description).toContain("**tutor**: *Unassigned*")
  })

  it("should fail if not in guild", async () => {
    mockInteraction.guild = null
    await command.summary(mockInteraction)
    expect(mockInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining("only be used in a server") }))
  })

  it("should show all roles as unassigned when no mappings exist", async () => {
    mockGuildManager.getAllRoles.mockResolvedValue([])

    await command.summary(mockInteraction)

    expect(mockGuildManager.getAllRoles).toHaveBeenCalledWith("guild-1")
    const replyCall = mockInteraction.reply.mock.calls[0][0]
    const description = replyCall.embeds[0].data.description
    expect(description).toContain("**admin**: *Unassigned*")
    expect(description).toContain("**tutor**: *Unassigned*")
    expect(description).toContain("**verified**: *Unassigned*")
    expect(description).toContain("**active_session**: *Unassigned*")
  })

  it("should handle getAllRoles throwing an error", async () => {
    mockGuildManager.getAllRoles.mockRejectedValue(new Error("Database error"))

    await expect(command.summary(mockInteraction)).rejects.toThrow("Database error")
    expect(mockGuildManager.getAllRoles).toHaveBeenCalledWith("guild-1")
  })
})
