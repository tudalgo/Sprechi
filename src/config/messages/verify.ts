/**
 * Verification command messages
 */

export const verifyCommand = {
  description: "Verify your account with a token",
  optionToken: "Your verification token",
  success: {
    title: "✅ Verification Successful",
    description: (roleNames: string[]) =>
      `You have been verified and granted the following roles:\n${roleNames.map(r => `• ${r}`).join("\n")}`,
  },
  errors: {
    default: "An unknown error occurred during verification",
    invalidToken: "❌ Invalid token. Please check your token and try again.",
    tokenAlreadyUsed: "❌ This token has already been used by another user.",
    wrongServer: "❌ This token is for a different server.",
    userNotInGuild: "❌ You must be a member of this server to verify.",
    title: "Verification Failed",
  },
}
