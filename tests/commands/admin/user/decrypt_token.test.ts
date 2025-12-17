import "reflect-metadata"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { AdminDecryptTokenCommand } from "@commands/admin/user/decrypt_token"
import { CommandInteraction } from "discord.js"
import { mockDeep } from "vitest-mock-extended"
import { InternalRole } from "@db/schema"

// Mock token utils
vi.mock("@utils/token", () => ({
  decryptTokenString: vi.fn(),
}))

// Mock logger
vi.mock("@utils/logger", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe("AdminDecryptTokenCommand", () => {
  let command: AdminDecryptTokenCommand
  let mockInteraction: any

  beforeEach(() => {
    command = new AdminDecryptTokenCommand()

    mockInteraction = mockDeep<CommandInteraction>()
    mockInteraction.user = { username: "admin" }
    mockInteraction.reply = vi.fn()

    vi.clearAllMocks()
  })

  it("should decrypt and display token successfully", async () => {
    const { decryptTokenString } = await import("@utils/token")
    const tokenData = {
      serverId: "guild-123",
      versionId: "01",
      tuId: "tu123",
      moodleId: "moodle456",
      roles: [InternalRole.Verified, InternalRole.Tutor],
    };
    (decryptTokenString as any).mockReturnValue(tokenData)

    await command.decryptToken("encrypted_token", mockInteraction)

    expect(decryptTokenString).toHaveBeenCalledWith("encrypted_token")
    expect(mockInteraction.reply).toHaveBeenCalled()

    const call = mockInteraction.reply.mock.calls[0][0]
    expect(call.embeds[0].data.title).toContain("Decrypted Token")
    const fields = call.embeds[0].data.fields
    expect(fields.some((f: any) => f.name === "Server ID" && f.value === "guild-123")).toBe(true)
    expect(fields.some((f: any) => f.name === "Version ID" && f.value === "01")).toBe(true)
    expect(fields.some((f: any) => f.name === "TU ID" && f.value === "tu123")).toBe(true)
    expect(fields.some((f: any) => f.name === "Moodle ID" && f.value === "moodle456")).toBe(true)
    expect(fields.some((f: any) => f.name === "Roles" && f.value.includes("verified"))).toBe(true)
  })

  it("should handle invalid token", async () => {
    const { decryptTokenString } = await import("@utils/token");
    (decryptTokenString as any).mockReturnValue(null)

    await command.decryptToken("invalid_token", mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalled()
    const call = mockInteraction.reply.mock.calls[0][0]
    expect(call.embeds[0].data.title).toContain("Invalid Token")
    expect(call.embeds[0].data.description).toContain("could not be decrypted")
  })

  it("should handle decryption errors", async () => {
    const { decryptTokenString } = await import("@utils/token");
    (decryptTokenString as any).mockImplementation(() => {
      throw new Error("Decryption failed")
    })

    await command.decryptToken("error_token", mockInteraction)

    expect(mockInteraction.reply).toHaveBeenCalled()
    const call = mockInteraction.reply.mock.calls[0][0]
    expect(call.embeds[0].data.title).toContain("Decryption Failed")
  })

  it("should display 'Not set' for missing IDs", async () => {
    const { decryptTokenString } = await import("@utils/token")
    const tokenData = {
      serverId: "guild-123",
      versionId: "01",
      tuId: "",
      moodleId: "",
      roles: [InternalRole.Verified],
    };
    (decryptTokenString as any).mockReturnValue(tokenData)

    await command.decryptToken("encrypted_token", mockInteraction)

    const call = mockInteraction.reply.mock.calls[0][0]
    const fields = call.embeds[0].data.fields
    expect(fields.some((f: any) => f.name === "TU ID" && f.value === "Not set")).toBe(true)
    expect(fields.some((f: any) => f.name === "Moodle ID" && f.value === "Not set")).toBe(true)
  })

  it("should include confidentiality warning in footer", async () => {
    const { decryptTokenString } = await import("@utils/token")
    const tokenData = {
      serverId: "guild-123",
      versionId: "01",
      tuId: "tu123",
      moodleId: "moodle456",
      roles: [InternalRole.Verified],
    };
    (decryptTokenString as any).mockReturnValue(tokenData)

    await command.decryptToken("encrypted_token", mockInteraction)

    const call = mockInteraction.reply.mock.calls[0][0]
    expect(call.embeds[0].data.footer.text).toContain("confidential")
  })
})
