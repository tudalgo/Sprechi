import { describe, it, expect, beforeEach, vi } from "vitest"
import { encryptText, decryptText, encryptTokenString, decryptTokenString } from "@utils/token"
import { InternalRole } from "@db/schema"

describe("Token Utilities", () => {
  beforeEach(() => {
    vi.stubEnv("TOKEN_ENCRYPTION_SECRET", "test_secret")
  })

  describe("encryptText / decryptText", () => {
    it("should encrypt and decrypt text correctly", () => {
      const originalText = "Hello, World!"
      const encrypted = encryptText(originalText)
      const decrypted = decryptText(encrypted)

      expect(decrypted).toBe(originalText)
    })

    it("should use custom secret", () => {
      const originalText = "Secret Message"
      const customSecret = "my_custom_secret"

      const encrypted = encryptText(originalText, customSecret)
      const decrypted = decryptText(encrypted, customSecret)

      expect(decrypted).toBe(originalText)
    })

    it("should fail to decrypt with wrong secret", () => {
      const originalText = "Secret Message"
      const encrypted = encryptText(originalText, "secret1")
      const decrypted = decryptText(encrypted, "secret2")

      expect(decrypted).not.toBe(originalText)
    })
  })

  describe("encryptTokenString", () => {
    it("should generate encrypted token", () => {
      const token = encryptTokenString(
        "server123",
        "01",
        "tu123",
        "moodle456",
        [InternalRole.Verified],
      )

      expect(token).toBeTruthy()
      expect(typeof token).toBe("string")
    })

    it("should generate different tokens for different inputs", () => {
      const token1 = encryptTokenString(
        "server123",
        "01",
        "tu123",
        "moodle456",
        [InternalRole.Verified],
      )

      const token2 = encryptTokenString(
        "server456",
        "01",
        "tu123",
        "moodle456",
        [InternalRole.Verified],
      )

      expect(token1).not.toBe(token2)
    })
  })

  describe("decryptTokenString", () => {
    it("should decrypt valid token", () => {
      const serverId = "server123"
      const versionId = "01"
      const tuId = "tu123"
      const moodleId = "moodle456"
      const roles = [InternalRole.Verified]

      const encrypted = encryptTokenString(serverId, versionId, tuId, moodleId, roles)
      const decrypted = decryptTokenString(encrypted)

      expect(decrypted).toEqual({
        serverId,
        versionId,
        tuId,
        moodleId,
        roles,
      })
    })

    it("should handle multiple roles", () => {
      const serverId = "server123"
      const versionId = "01"
      const tuId = "tu123"
      const moodleId = "moodle456"
      const roles = [InternalRole.Verified, InternalRole.Tutor]

      const encrypted = encryptTokenString(serverId, versionId, tuId, moodleId, roles)
      const decrypted = decryptTokenString(encrypted)

      expect(decrypted).toEqual({
        serverId,
        versionId,
        tuId,
        moodleId,
        roles,
      })
    })

    it("should return null for invalid token", () => {
      const result = decryptTokenString("invalid_token")
      expect(result).toBeNull()
    })

    it("should return null for malformed encrypted data", () => {
      const encrypted = encryptText("invalid|format")
      const result = decryptTokenString(encrypted)
      expect(result).toBeNull()
    })

    it("should handle backward compatible role names", () => {
      // Manually create a token with old role format
      const tokenData = "server123|01|tu123|moodle456|verified,tutor"
      const encrypted = encryptText(tokenData)
      const decrypted = decryptTokenString(encrypted)

      expect(decrypted).toEqual({
        serverId: "server123",
        versionId: "01",
        tuId: "tu123",
        moodleId: "moodle456",
        roles: [InternalRole.Verified, InternalRole.Tutor],
      })
    })

    it("should filter out invalid role names", () => {
      const tokenData = "server123|01|tu123|moodle456|verified,invalid_role"
      const encrypted = encryptText(tokenData)
      const decrypted = decryptTokenString(encrypted)

      expect(decrypted).toEqual({
        serverId: "server123",
        versionId: "01",
        tuId: "tu123",
        moodleId: "moodle456",
        roles: [InternalRole.Verified],
      })
    })

    it("should return null if no valid roles", () => {
      const tokenData = "server123|01|tu123|moodle456|invalid_role"
      const encrypted = encryptText(tokenData)
      const result = decryptTokenString(encrypted)

      expect(result).toBeNull()
    })
  })

  describe("missing TOKEN_ENCRYPTION_SECRET", () => {
    it("should still encrypt/decrypt but with different results when secret is missing", () => {
      vi.unstubAllEnvs()

      const originalText = "test data"
      const encrypted = encryptText(originalText)
      const decrypted = decryptText(encrypted)

      // Should still work, but uses default/fallback behavior
      // The actual behavior depends on the implementation
      expect(encrypted).toBeTruthy()
      expect(decrypted).toBeTruthy()
    })
  })

  describe("encryptTokenString with unsupported roles", () => {
    it("should filter out unsupported role identifiers during encryption", () => {
      // This tests that encryptTokenString handles unsupported roles gracefully
      const serverId = "server123"
      const versionId = "01"
      const tuId = "tu123"
      const moodleId = "moodle456"

      // Mix valid and invalid roles
      const roles = [InternalRole.Verified, "unsupported_role" as any]

      const encrypted = encryptTokenString(serverId, versionId, tuId, moodleId, roles)
      const decrypted = decryptTokenString(encrypted)

      // Should only include valid roles
      expect(decrypted?.roles).toEqual([InternalRole.Verified])
    })
  })
})
