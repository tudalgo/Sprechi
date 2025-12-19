import CryptoJS from "crypto-js"
import { InternalRole } from "@db/schema"

/**
 * Encrypts a given text using AES encryption
 * @param text The text to encrypt
 * @param secret The encryption secret (defaults to env variable)
 * @returns the encrypted text
 */
export function encryptText(text: string, secret?: string): string {
  const encryptionSecret = secret ?? process.env.TOKEN_ENCRYPTION_SECRET ?? ""
  return CryptoJS.AES.encrypt(text, encryptionSecret).toString()
}

/**
 * Decrypts a given text using AES decryption
 * @param text the text to decrypt
 * @param secret The encryption secret (defaults to env variable)
 * @returns the decrypted text, or an empty string if decryption fails
 */
export function decryptText(text: string, secret?: string): string {
  try {
    const encryptionSecret = secret ?? process.env.TOKEN_ENCRYPTION_SECRET ?? ""
    return CryptoJS.AES.decrypt(text, encryptionSecret).toString(CryptoJS.enc.Utf8)
  } catch {
    // Return empty string when decryption fails (e.g., wrong secret, malformed data)
    return ""
  }
}

export interface TokenData {
  serverId: string
  versionId: string
  tuId: string
  moodleId: string
  roles: InternalRole[]
}

/**
 * Generates an encrypted token string with the given parameters
 * @param serverId The ID of the Discord server
 * @param versionId The token version
 * @param tuId The TU ID
 * @param moodleId The Moodle ID
 * @param roles The internal roles to assign
 * @returns The generated encrypted token
 */
export function encryptTokenString(
  serverId: string,
  versionId: string,
  tuId: string,
  moodleId: string,
  roles: InternalRole[],
): string {
  const token = `${serverId}|${versionId}|${tuId}|${moodleId}|${roles.join(",")}`
  return encryptText(token)
}

/**
 * Decrypts and parses a token string
 * @param encryptedToken The encrypted token string
 * @returns The parsed token data or null if invalid
 */
export function decryptTokenString(encryptedToken: string): TokenData | null {
  try {
    const decrypted = decryptText(encryptedToken)
    if (!decrypted) return null

    const parts = decrypted.split("|")
    if (parts.length !== 5) return null

    const [serverId, versionId, tuId, moodleId, rolesStr] = parts

    // Parse roles - handle both old and new format
    const roles = rolesStr.split(",").filter(r => r.trim())
      .map((roleStr) => {
        // Map old role names to new InternalRole enum if needed
        const roleLower = roleStr.toLowerCase().trim()
        switch (roleLower) {
          case "verified":
            return InternalRole.Verified
          case "tutor":
            return InternalRole.Tutor
          case "admin":
            return InternalRole.Admin
          case "active_session":
            return InternalRole.ActiveSession
          default:
            // Try to match as-is in case it's already the correct format
            if (Object.values(InternalRole).includes(roleStr as InternalRole)) {
              return roleStr as InternalRole
            }
            return null
        }
      })
      .filter((r): r is InternalRole => r !== null)

    if (roles.length === 0) return null

    return {
      serverId,
      versionId,
      tuId,
      moodleId,
      roles,
    }
  } catch {
    return null
  }
}
