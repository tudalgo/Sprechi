/**
 * Event handler messages
 */

// =============================================================================
// EVENTS
// =============================================================================

export const events = {
  guildMemberAdd: {
    dm: {
      title: (guildName: string) => `Welcome to ${guildName}! 🎉`,
      description:
        "To get full access to the server, you need to verify your account.\n\n**How to verify:**\n• If you have a verification token, simply paste it in this DM\n• Alternatively, use the `/verify` command in the server with your token\n\nOnce verified, you'll receive your roles automatically!",
      footer: "For further information, please see the Moodle course.",
    },
  },
  messageCreate: {
    invalidToken: {
      title: "❌ Invalid Token",
      description: "The token you provided is invalid. Please check your token and try again.",
    },
    missingServer: {
      title: "❌ Server Not Found",
      description: "The server for this token could not be found. The bot may not be in that server anymore.",
    },
    success: {
      title: "✅ Verification Successful",
      description: (guildName: string, roleNames: string[]) =>
        `You have been verified in **${guildName}**!\n\n**Roles granted:**\n${roleNames.map(r => `• ${r}`).join("\n")}`,
    },
    errors: {
      defaultDescription: "❌ An error occurred during verification. Please try again or contact an admin.",
      invalidToken: "❌ Invalid token. Please check your token and try again.",
      tokenAlreadyUsed: "❌ This token has already been used by another user.",
      userNotInGuild: (guildName: string) =>
        `❌ You are not a member of **${guildName}**. Please join the server first, then verify.`,
      title: "Verification Failed",
    },
  },
  queueButtons: {
    errors: {
      queueNotFound: "Queue not found.",
      notInQueueAnymore: "You are not in this queue anymore.",
      notInQueue: "You are not in the queue.",
      tutorSessionConflict: "You cannot join a queue while you have an active tutor session.",
      failedToRejoin: "Failed to rejoin queue.",
      title: "Error",
    },
    joinedQueue: {
      title: (queueName: string) => `Joined Queue: ${queueName}`,
      description: (queueName: string, position: number, joinedAtSeconds: number) =>
        `You have joined the queue **${queueName}**.\n\n**Position:** ${position}\n**Joined:** <t:${joinedAtSeconds}:R>`,
    },
    leftQueue: {
      title: "Left Queue",
      description: (queueName: string) => `You have left the queue **${queueName}**.`,
    },
    rejoinedQueue: {
      title: "Rejoined Queue",
      description: (queueName: string) => `You have rejoined the queue **${queueName}**.`,
    },
  },
  voiceStateUpdate: {
    queueLocked: {
      title: "Queue Locked",
      description: "The queue you tried to join is currently locked. Please try again later.",
    },
  },
}
