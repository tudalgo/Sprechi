import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { DmManager } from "@managers/DmManager"
import { Client, EmbedBuilder } from "discord.js"
import { mockDeep } from "vitest-mock-extended"

// Mock logger
vi.mock("@utils/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe("DmManager", () => {
  let dmManager: DmManager
  let mockClient: any
  let mockUser: any

  beforeEach(() => {
    dmManager = new DmManager()
    mockClient = mockDeep<Client>()
    mockUser = {
      send: vi.fn(),
    }
    mockClient.users.fetch.mockResolvedValue(mockUser)
    vi.clearAllMocks()
  })

  it("should send a string message successfully", async () => {
    const userId = "user-123"
    const content = "Hello, world!"

    const result = await dmManager.sendDm(mockClient, userId, content)

    expect(mockClient.users.fetch).toHaveBeenCalledWith(userId)
    expect(mockUser.send).toHaveBeenCalledWith(content)
    expect(result).toBe(true)
  })

  it("should send an embed message successfully", async () => {
    const userId = "user-123"
    const embed = new EmbedBuilder().setTitle("Test Embed")

    const result = await dmManager.sendDm(mockClient, userId, embed)

    expect(mockClient.users.fetch).toHaveBeenCalledWith(userId)
    expect(mockUser.send).toHaveBeenCalledWith({ embeds: [embed] })
    expect(result).toBe(true)
  })

  it("should handle errors gracefully", async () => {
    const userId = "user-123"
    const content = "Hello, world!"

    mockClient.users.fetch.mockRejectedValue(new Error("User not found"))

    const result = await dmManager.sendDm(mockClient, userId, content)

    expect(result).toBe(false)
  })
})
