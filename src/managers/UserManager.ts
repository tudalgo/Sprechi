import db, { users, InternalRole } from "@db"
import logger from "@utils/logger"
import { decryptTokenString, TokenData } from "@utils/token"
import {
  InvalidTokenError,
  TokenAlreadyUsedError,
  WrongServerError,
  UserNotInGuildError,
  UserNotVerifiedError,
} from "@errors/UserErrors"
import { GuildMember, Role, Guild } from "discord.js"
import { GuildManager } from "./GuildManager"
import { inject, injectable } from "tsyringe"

@injectable()
export class UserManager {
  constructor(
    @inject(GuildManager) private guildManager: GuildManager,
  ) { }

  /**
   * Verifies a user with a token and assigns their roles
   * @param member The guild member to verify
   * @param encryptedToken The encrypted verification token
   * @returns The assigned role names
   * @throws {InvalidTokenError} If the token is invalid
   * @throws {WrongServerError} If the token is for a different server
   * @throws {TokenAlreadyUsedError} If the token was already used by another user
   */
  async verifyUser(member: GuildMember, encryptedToken: string): Promise<string[]> {
    // Decrypt and validate token
    const tokenData = decryptTokenString(encryptedToken)
    if (!tokenData) {
      throw new InvalidTokenError()
    }

    // Check if token is for this server
    if (tokenData.serverId !== member.guild.id) {
      throw new WrongServerError(tokenData.serverId)
    }

    // Check if token was already used by a different user
    await this.checkTokenUsage(tokenData, member.user.id, member.guild.id)

    // Save or update user in database
    await this.saveUserData(member.user.id, member.guild.id, tokenData)

    // Assign roles to user
    const roleNames = await this.assignRoles(member, tokenData.roles)

    logger.info(`[UserManager] Verified user ${member.user.username} (${member.user.id}) in guild ${member.guild.name}`)

    return roleNames
  }

  /**
   * Checks if a token has already been used by another user
   * @throws {TokenAlreadyUsedError} If token was used by another user
   */
  private async checkTokenUsage(tokenData: TokenData, discordId: string, guildId: string): Promise<void> {
    if (!tokenData.moodleId) return

    const existingUser = await db.query.users.findFirst({
      where: (table, { eq, and }) => and(
        eq(table.moodleId, tokenData.moodleId),
        eq(table.guildId, guildId),
      ),
    })

    if (existingUser && existingUser.discordId !== discordId) {
      logger.warn(`[UserManager] Token with moodleId ${tokenData.moodleId} already used by user ${existingUser.discordId}`)
      throw new TokenAlreadyUsedError()
    }
  }

  /**
   * Saves or updates user data in the database
   */
  private async saveUserData(discordId: string, guildId: string, tokenData: TokenData): Promise<void> {
    await db.insert(users).values({
      discordId,
      guildId,
      tuId: tokenData.tuId || null,
      moodleId: tokenData.moodleId || null,
      roles: tokenData.roles,
    }).onConflictDoUpdate({
      target: [users.discordId, users.guildId],
      set: {
        tuId: tokenData.tuId || null,
        moodleId: tokenData.moodleId || null,
        roles: tokenData.roles,
        updatedAt: new Date(),
      },
    })
  }

  /**
   * Assigns Discord roles to a member based on internal roles
   * @returns Array of assigned role names
   */
  private async assignRoles(member: GuildMember, internalRoles: InternalRole[]): Promise<string[]> {
    const rolesToAssign: Role[] = []

    for (const internalRole of internalRoles) {
      const roleId = await this.guildManager.getRole(member.guild.id, internalRole)
      if (roleId) {
        const role = member.guild.roles.cache.get(roleId)
        if (role) {
          rolesToAssign.push(role)
        }
      }
    }

    if (rolesToAssign.length > 0) {
      await member.roles.add(rolesToAssign)
      logger.info(`[UserManager] Assigned roles ${rolesToAssign.map(r => r.name).join(", ")} to ${member.user.username}`)
    }

    return rolesToAssign.map(r => r.name)
  }

  /**
   * Re-applies saved roles to a user when they rejoin the server
   */
  async reapplyRoles(member: GuildMember): Promise<void> {
    const userData = await db.query.users.findFirst({
      where: (table, { eq, and }) => and(
        eq(table.discordId, member.user.id),
        eq(table.guildId, member.guild.id),
      ),
    })

    if (!userData || !userData.roles || userData.roles.length === 0) {
      return
    }

    const roleNames = await this.assignRoles(member, userData.roles as InternalRole[])

    if (roleNames.length > 0) {
      logger.info(`[UserManager] Re-applied roles to ${member.user.username} (${member.user.id})`)
    }
  }

  /**
   * Gets user data for a guild member
   * @throws {UserNotInGuildError} If the user is not in the specified guild
   * @throws {UserNotVerifiedError} If the user is not verified
   */
  async getUserData(member: GuildMember) {
    const userData = await db.query.users.findFirst({
      where: (table, { eq, and }) => and(
        eq(table.discordId, member.user.id),
        eq(table.guildId, member.guild.id),
      ),
    })

    if (!userData) {
      throw new UserNotVerifiedError()
    }

    return userData
  }

  /**
   * Searches for a user by different ID types
   */
  async searchUser(guildId: string, idType: "discord" | "tu" | "moodle", idValue: string) {
    let userData

    switch (idType) {
      case "discord":
        userData = await db.query.users.findFirst({
          where: (table, { eq, and }) => and(
            eq(table.discordId, idValue),
            eq(table.guildId, guildId),
          ),
        })
        break
      case "tu":
        userData = await db.query.users.findFirst({
          where: (table, { eq, and }) => and(
            eq(table.tuId, idValue),
            eq(table.guildId, guildId),
          ),
        })
        break
      case "moodle":
        userData = await db.query.users.findFirst({
          where: (table, { eq, and }) => and(
            eq(table.moodleId, idValue),
            eq(table.guildId, guildId),
          ),
        })
        break
    }

    if (!userData) {
      throw new UserNotVerifiedError()
    }

    return userData
  }

  /**
   * Checks if a user is a member of a guild
   */
  async checkUserInGuild(guild: Guild, userId: string): Promise<void> {
    try {
      await guild.members.fetch(userId)
    } catch {
      throw new UserNotInGuildError()
    }
  }
}
