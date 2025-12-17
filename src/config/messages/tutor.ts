/**
 * Tutor command messages
 */

// =============================================================================
// COMMANDS - Tutor General
// =============================================================================

export const tutorCommands = {
  help: {
    description: "Get help with tutor commands",
    embed: {
      title: "🎓 Tutor Help - Tutor Commands",
      description: "Here are the available commands for tutors to manage sessions and help students:",
      fields: {
        startSession: {
          name: "🟢 Start a Session",
          value:
            "`/tutor session start [queue]`\nStart a tutoring session on a queue. If no queue is specified, the default queue will be used.",
        },
        endSession: {
          name: "🔴 End a Session",
          value: "`/tutor session end`\nEnd your current tutoring session.",
        },
        pickNext: {
          name: "➡️ Pick Next Student",
          value:
            "`/tutor queue next`\nPick the next student from your active queue. This will create a private voice channel for you and the student.",
        },
        pickSpecific: {
          name: "👤 Pick Specific Student",
          value: "`/tutor queue pick [user]`\nPick a specific student from your active queue.",
        },
        listQueue: {
          name: "📋 List Queue Members",
          value: "`/tutor queue list [max_entries]`\nView members waiting in your active session's queue.",
        },
        sessionSummary: {
          name: "📊 Session Summary",
          value: "`/tutor summary`\nView a summary of your current session, including students helped.",
        },
        voiceManagement: {
          name: "🎤 Voice Channel Management",
          value:
            "`/tutor voice close` - Close your current temporary voice channel\n`/tutor voice kick [user]` - Kick a user from your voice channel\n`/tutor voice permit [user]` - Grant a user access to your voice channel",
        },
      },
      footer: "Tip: Use /tutor session start to begin helping students!",
    },
    errors: {
      title: "Error",
      description: "Failed to display help information.",
    },
  },
  summary: {
    description: "Get an overview of your tutoring sessions",
    embed: {
      title: "Tutor Summary",
      description: "Overview of your tutoring stats.",
      fields: {
        totalSessions: "Total Sessions",
        totalTime: "Total Time",
        studentsHelped: "Students Helped",
      },
    },
    errors: {
      default: "Failed to get tutor summary.",
      reply: "An error occurred while fetching your summary.",
    },
  },
}

// =============================================================================
// COMMANDS - Tutor Queue
// =============================================================================

export const tutorQueueCommands = {
  list: {
    description: "List members in the active session's queue",
    optionMaxEntries: "Maximum number of entries to list (default: 5)",
    errors: {
      noActiveSession: "You do not have an active session.",
      default: "An error occurred.",
      title: "Error",
    },
  },
  next: {
    description: "Pick the next student from the queue",
    errors: {
      noActiveSession: "You do not have an active session.",
      title: "Error",
      default: "An error occurred.",
    },
    emptyQueue: {
      title: (queueName: string) => `Queue: ${queueName}`,
      description: "The queue is empty.",
    },
  },
  pick: {
    description: "Pick a specific student from the queue",
    optionUser: "The user to pick",
    errors: {
      noActiveSession: "You do not have an active session.",
      notInQueue: (userId: string, queueName: string) => `<@${userId}> is not in the queue '${queueName}'.`,
      default: "An error occurred.",
      title: "Error",
    },
  },
  summary: {
    description: "Show summary of the active session's queue",
    errors: {
      noActiveSession: "You do not have an active session.",
      default: "An error occurred.",
      title: "Error",
    },
  },
}

// =============================================================================
// COMMANDS - Tutor Sessions
// =============================================================================

export const tutorSessionCommands = {
  start: {
    description: "Start a tutoring session",
    optionQueue: "The name of the queue (optional)",
    success: {
      title: "Session Started",
      description: (queueName: string) => `You have started a session on queue **${queueName}**.`,
    },
    errors: {
      default: "Failed to start session.",
      notFound: (name: string) => `Queue **${name}** not found.`,
      alreadyActive: "You already have an active session.",
      studentInQueue: "You cannot start a session while you are in a queue.",
      title: "Error",
    },
  },
  end: {
    description: "End your tutoring session",
    success: {
      title: "Session Ended",
      description: "You have ended your session.",
    },
    errors: {
      default: "Failed to end session.",
      title: "Error",
    },
  },
  summary: {
    description: "Get summary of the current session",
    errors: {
      noActiveSession: "You do not have an active session.",
      default: "Failed to get session info.",
      title: "Error",
    },
    embed: {
      title: "Session Summary",
      fields: {
        queue: "Queue",
        started: "Started",
        duration: "Duration",
        studentsHelped: "Students Helped",
      },
    },
  },
}

// =============================================================================
// COMMANDS - Tutor Voice
// =============================================================================

export const tutorVoiceCommands = {
  close: {
    description: "Close the current temporary voice channel",
    errors: {
      missingVoiceChannel: "You must be in a voice channel to use this command.",
      nonEphemeralChannel: "This command can only be used in a temporary Tutor voice channel.",
      title: "Error",
      description: "Failed to close the channel.",
    },
    success: {
      title: "Channel Closed",
      description: (channelName: string) => `Voice channel **${channelName}** has been closed.`,
    },
  },
  kick: {
    description: "Kick a user from the current voice channel",
    optionUser: "The user to kick",
    errors: {
      missingVoiceChannel: "You must be in a voice channel to use this command.",
      userNotInChannel: "The specified user is not in your voice channel.",
      nonEphemeralChannel: "This command can only be used in a temporary Tutor voice channel.",
      title: "Error",
      description: "Failed to kick the user.",
    },
    success: {
      title: "User Kicked",
      description: (userDisplayName: string, channelName: string) =>
        `Kicked **${userDisplayName}** from **${channelName}**.`,
    },
  },
  permit: {
    description: "Permit a user to join the current temporary voice channel",
    optionUser: "The user to permit",
    errors: {
      missingVoiceChannel: "You must be in a voice channel to use this command.",
      nonEphemeralChannel: "This command can only be used in a temporary Tutor voice channel.",
      title: "Error",
      description: "Failed to permit the user.",
    },
    success: {
      title: "User Permitted",
      description: (userDisplayName: string, channelName: string) =>
        `Permitted **${userDisplayName}** to join **${channelName}**.`,
      queuePickSuffix: (queueName: string) => `Also picked from queue **${queueName}**.`,
    },
  },
}
