import { describe, it, expect, vi, beforeEach } from "vitest"
import { run } from "../src/dev"
import { bot } from "@/bot"
import { migrateDb } from "@/migrate"
import { MissingBotTokenError } from "@errors/ConfigErrors"

// Mock dependencies
vi.mock("@/bot", () => ({
  bot: {
    login: vi.fn(),
    removeEvents: vi.fn(),
    initApplicationCommands: vi.fn(),
    initEvents: vi.fn(),
  },
}))

vi.mock("@/migrate", () => ({
  migrateDb: vi.fn(),
}))

vi.mock("@discordx/importer", () => ({
  dirname: vi.fn(() => "/mock/path"),
  resolve: vi.fn(() => Promise.resolve([])),
}))

vi.mock("chokidar", () => ({
  default: {
    watch: vi.fn(() => ({
      on: vi.fn(),
    })),
  },
}))

describe("dev.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default to dev env
    vi.stubEnv("NODE_ENV", "development")
  })

  it("should throw MissingBotTokenError when BOT_TOKEN is not set", async () => {
    vi.unstubAllEnvs()
    vi.stubEnv("NODE_ENV", "development")
    delete process.env.BOT_TOKEN

    await expect(run()).rejects.toThrow(MissingBotTokenError)
  })

  it("should call migrateDb and bot.login on startup", async () => {
    vi.stubEnv("BOT_TOKEN", "test-token-123")

    await run()

    expect(migrateDb).toHaveBeenCalled()
    expect(bot.login).toHaveBeenCalledWith("test-token-123")
  })
})
