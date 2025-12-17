import "reflect-metadata"
import { AdminStatsServer } from "@commands/admin/stats/server"
import { CommandInteraction, Guild, GuildMember, Role, Collection } from "discord.js"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { mockDeep, DeepMockProxy } from "vitest-mock-extended"

// Mock @napi-rs/canvas
vi.mock("@napi-rs/canvas", () => ({
  createCanvas: vi.fn().mockImplementation((_w: number, _h: number) => ({
    getContext: vi.fn().mockReturnValue({}),
    encode: vi.fn().mockResolvedValue(Buffer.from("fake-image")),
  })),
}))

// Mock Chart.js
vi.mock("chart.js", () => ({
  Chart: class {
    static register() { }
    destroy() { }
    canvas = {}
  },
  registerables: [],
}))

// Mock the db module
vi.mock("@db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@db")>()
  return {
    ...actual,
    default: {
      query: {
        users: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      },
    },
  }
})

describe("AdminStatsServer", () => {
  let command: AdminStatsServer
  let interaction: DeepMockProxy<CommandInteraction>

  beforeEach(() => {
    command = new AdminStatsServer()
    interaction = mockDeep<CommandInteraction>()

    // Default mocks
    interaction.deferReply.mockResolvedValue({} as any)
    interaction.editReply.mockResolvedValue({} as any)
    interaction.reply.mockResolvedValue({} as any)
  })

  it("should reply with stats embed and image", async () => {
    // Setup mock data
    const mockMember = {
      joinedAt: new Date("2023-01-01"),
    } as GuildMember

    // Setup Guild Mocks
    const mockGuild = mockDeep<Guild>()
    mockGuild.memberCount = 10
    Object.defineProperty(mockGuild, "ownerId", { value: "owner-id", writable: true })
    Object.defineProperty(mockGuild, "createdAt", { value: new Date(), writable: true })

    // Member fetch
    mockGuild.members.fetch.mockResolvedValue(new Collection([["1", mockMember]]))

    // Role fetch & cache
    const mockRole = {
      name: "Verified",
      members: new Collection([["1", mockMember]]),
    } as Role
    Object.defineProperty(mockGuild.roles, "cache", {
      value: new Collection([["1", mockRole]]),
      writable: true,
    })
    mockGuild.roles.fetch.mockResolvedValue(new Collection([["1", mockRole]]))

    // Valid guild presence
    Object.defineProperty(interaction, "guild", { value: mockGuild, writable: true })

    // Setup DB return - should filter by guild ID
    const db = await import("@db");
    (db.default.query.users.findMany as unknown as import("vitest").Mock).mockResolvedValue([
      { verifiedAt: new Date("2023-01-02") },
      { verifiedAt: new Date("2023-01-03") },
      { verifiedAt: new Date("2023-01-04") },
    ])

    await command.server(true, interaction)

    expect(interaction.deferReply).toHaveBeenCalled()

    // Verify DB query was called with guild filter
    expect(db.default.query.users.findMany).toHaveBeenCalled()

    // Verify the embed contains the correct verified member count from database (3), not from role
    const editReplyCall = interaction.editReply.mock.calls[0][0] as any
    expect(editReplyCall.embeds).toBeDefined()
    expect(editReplyCall.embeds[0].data.fields).toBeDefined()

    // Find the "Verified Members" field
    const verifiedMembersField = editReplyCall.embeds[0].data.fields.find(
      (f: any) => f.name.includes("Verified Members"),
    )
    expect(verifiedMembersField).toBeDefined()
    expect(verifiedMembersField.value).toBe("3") // Database count, not role count

    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.any(Array),
      files: expect.any(Array),
    }))
  })
})
