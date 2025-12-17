import "reflect-metadata"
import { AdminStatsSessions } from "@commands/admin/stats/sessions"
import { CommandInteraction, Guild } from "discord.js"
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
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([]),
    },
  }
})

describe("AdminStatsSessions", () => {
  let command: AdminStatsSessions
  let interaction: DeepMockProxy<CommandInteraction>

  beforeEach(() => {
    command = new AdminStatsSessions()
    interaction = mockDeep<CommandInteraction>()

    Object.defineProperty(interaction, "guild", {
      value: mockDeep<Guild>(),
      writable: true,
    })
    interaction.deferReply.mockResolvedValue({} as any)
    interaction.editReply.mockResolvedValue({} as any)
    interaction.reply.mockResolvedValue({} as any)
  })

  it("should reply with session stats embeds and images", async () => {
    // Mock DB responses - we use the mocked db that has orderBy
    const db = (await import("@db")).default as any

    // First query: studentsPerQueue
    db.orderBy.mockResolvedValueOnce([
      { queueName: "Test Queue", count: 5 },
    ])

    // Second query: activityByHour
    db.orderBy.mockResolvedValueOnce([
      { dow: 1, hour: 14, count: 2 },
    ])

    await command.sessions(interaction)

    expect(interaction.deferReply).toHaveBeenCalled()
    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({
      embeds: expect.arrayContaining([expect.anything(), expect.anything()]),
      files: expect.arrayContaining([expect.anything(), expect.anything()]),
    }))
  })
})
