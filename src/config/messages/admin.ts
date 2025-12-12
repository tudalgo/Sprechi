/**
 * Admin command messages
 */
// =============================================================================
// COMMANDS - Admin General
// =============================================================================

export const adminCommands = {
  botinfo: {
    description: "Display bot information",
    embed: {
      title: "Bot Information",
      fields: {
        uptime: "Uptime",
        memoryUsage: "Memory Usage",
        guilds: "Guilds",
        version: "Version",
        discordJs: "Discord.js",
        nodeJs: "Node.js",
      },
    },
  },
  help: {
    description: "Get help with admin commands and server setup",
    embed: {
      title: "⚙️ Admin Help - Server Setup Guide",
      description: "Follow these steps to set up and manage your queue system:",
      fields: {
        configureRoles: {
          name: "1️⃣ Configure Roles",
          value:
            "`/admin role set [internal_role] [server_role]`\nSet up internal role mappings:\n• `admin` - Administrators who can manage the system\n• `tutor` - Tutors who can help students\n• `verified` - Verified members\n• `active_session` - Role given to tutors during active sessions",
        },
        createQueues: {
          name: "2️⃣ Create Queues",
          value: "`/admin queue create [name] [description]`\nCreate a new queue for students to join.",
        },
        configureSettings: {
          name: "3️⃣ Configure Queue Settings",
          value:
            "`/admin queue waiting-room [name] [channel]`\nSet a voice channel as a waiting room for automatic queue joining.\n\n`/admin queue log-channel-public [name] [channel]`\nSet a channel for public queue activity logs.\n\n`/admin queue log-channel-private [name] [channel]`\nSet a channel for private tutor session logs.",
        },
        scheduleAutoLock: {
          name: "4️⃣ Schedule & Auto-Lock",
          value:
            "`/admin queue schedule add [name] [day] [start] [end]`\nAdd schedule times for when the queue should be unlocked.\n\n`/admin queue auto-lock [name] [enabled]`\nEnable automatic queue locking based on schedule.\n\n`/admin queue schedule shift [name] [minutes]`\nAdjust schedule times by a specified number of minutes.",
        },
        viewStats: {
          name: "5️⃣ View Statistics",
          value:
            "`/admin stats server [show-empty-days]`\nView server statistics including member joins and verifications.\n\n`/admin stats sessions [queue]`\nView session statistics for a specific queue.",
        },
        otherCommands: {
          name: "📋 Other Useful Commands",
          value:
            "`/admin queue list [name]` - List members in a specific queue\n`/admin queue summary [name]` - View queue details\n`/admin queue lock [name]` - Manually lock a queue\n`/admin queue unlock [name]` - Manually unlock a queue\n`/admin role summary` - View current role mappings\n`/admin botinfo` - View bot information",
        },
      },
      footer: "Pro tip: Start by setting up roles, then create queues!",
    },
    errors: {
      title: "Error",
      description: "Failed to display help information.",
    },
  },
}

// =============================================================================
// COMMANDS - Admin Queue
// =============================================================================

export const adminQueueCommands = {
  groupDescription: {
    admin: "Admin commands",
    queue: "Queue management commands",
  },
  autoLock: {
    description: "Enable automatic locking based on schedule",
    optionName: "The name of the queue",
    success: {
      title: "Auto Mode Enabled",
      description: (name: string) => `Enabled automatic scheduling for queue **${name}**.`,
    },
    errors: {
      default: "An error occurred.",
      title: "Error",
    },
  },
  create: {
    description: "Create a new queue",
    optionName: "The name of the queue",
    optionDescription: "The description of the queue",
    success: {
      title: ":white_check_mark: Queue Created",
      description: (queueName: string, description: string) => `**${queueName}**\n${description}`,
    },
    duplicateQueue: {
      title: ":x: Queue Already Exists",
      description: (queueName: string) => `A queue named **${queueName}** already exists in this server.`,
    },
    failure: {
      title: ":x: Queue Creation Failed",
      description: (queueName: string) => `Failed to create the queue **${queueName}**.`,
    },
  },
  list: {
    description: "List users in a specific queue",
    optionName: "Name of the queue",
    optionMaxEntries: "Max number of users to show (default: 5)",
    errors: {
      default: "An error occurred.",
      title: "Error",
    },
  },
  lock: {
    description: "Lock a queue",
    optionName: "The name of the queue to lock",
    success: {
      title: "Queue Locked",
      description: (name: string) => `Queue **${name}** has been locked.`,
    },
    errors: {
      default: "An error occurred.",
      title: "Error",
    },
  },
  summary: {
    description: "Show a summary of a specific queue",
    optionName: "Name of the queue",
    errors: {
      default: "An error occurred.",
      title: "Error",
    },
  },
  unlock: {
    description: "Unlock a queue",
    optionName: "The name of the queue to unlock",
    success: {
      title: "Queue Unlocked",
      description: (name: string) => `Queue **${name}** has been unlocked.`,
    },
    errors: {
      default: "An error occurred.",
      title: "Error",
    },
  },
  waitingRoom: {
    description: "Set the waiting room for a queue",
    optionName: "The name of the queue",
    optionChannel: "The voice channel to use as waiting room",
    success: {
      title: "Waiting Room Set",
      description: (name: string, channelId: string) => `Waiting room for queue **${name}** set to <#${channelId}>.`,
    },
    errors: {
      default: "Failed to set waiting room.",
      notFound: (name: string) => `Queue **${name}** not found.`,
      title: "Error",
    },
  },
  logChannel: {
    setPrivate: {
      description: "Set the private log channel for a queue",
      optionName: "The name of the queue",
      optionChannel: "The text channel to use for logs",
      success: {
        title: "Private Log Channel Set",
        description: (name: string, channelId: string) =>
          `Private log channel for queue **${name}** set to <#${channelId}>.`,
      },
      errors: {
        default: "Failed to set log channel.",
        notFound: (name: string) => `Queue **${name}** not found.`,
        title: "Error",
      },
    },
    setPublic: {
      description: "Set the public log channel for a queue",
      optionName: "The name of the queue",
      optionChannel: "The text channel to use for public logs",
      success: {
        title: "Public Log Channel Set",
        description: (name: string, channelId: string) =>
          `Public log channel for queue **${name}** set to <#${channelId}>.`,
      },
      errors: {
        default: "Failed to set public log channel.",
        notFound: (name: string) => `Queue **${name}** not found.`,
        title: "Error",
      },
    },
  },
  schedule: {
    add: {
      description: "Add a schedule to a queue",
      optionName: "The name of the queue",
      optionDay: "Day of the week (e.g. Monday)",
      optionStart: "Start time (HH:mm)",
      optionEnd: "End time (HH:mm)",
      success: {
        title: "Schedule Added",
        description: (name: string, day: string, start: string, end: string) =>
          `Added schedule for queue **${name}** on **${day}**: ${start} - ${end}.`,
      },
      errors: {
        default: "An error occurred.",
        title: "Error",
      },
    },
    remove: {
      description: "Remove a schedule from a queue",
      optionName: "The name of the queue",
      optionDay: "Day of the week (e.g. Monday)",
      success: {
        title: "Schedule Removed",
        description: (name: string, day: string) => `Removed schedule for queue **${name}** on **${day}**.`,
      },
      errors: {
        default: "An error occurred.",
        title: "Error",
      },
    },
    shift: {
      description: "Set start/end time shift",
      optionName: "The name of the queue",
      optionMinutes: "Shift in minutes (positive = earlier, negative = later)",
      success: {
        title: "Schedule Shift Set",
        description: (name: string, minutes: number) =>
          `Set schedule shift for queue **${name}** to **${minutes} minutes**.`,
      },
      errors: {
        default: "An error occurred.",
        title: "Error",
      },
    },
    summary: {
      description: "View all configured schedules for a queue",
      optionName: "The name of the queue",
      optionHidePrivateInfo: "Hide private information",
      autoLockInfo: (enabled: boolean) => `**Auto-Lock:** ${enabled ? "✅ Enabled" : "❌ Disabled"}`,
      emptySchedule: {
        title: (name: string) => `Schedule Summary: ${name}`,
        description: (autoLockInfo: string) => `${autoLockInfo}\n\nNo schedules configured for this queue.`,
      },
      shiftInfo: (minutes: number) => `**Time Shift:** ${minutes > 0 ? "-" : "+"}${Math.abs(minutes)} minutes`,
      populatedDescription: (autoLockInfo: string, shiftInfo: string, scheduleLines: string) =>
        `${autoLockInfo}${shiftInfo}\n\n${scheduleLines}`,
      errors: {
        default: "An error occurred.",
        title: "Error",
      },
    },
  },
}

// =============================================================================
// COMMANDS - Admin Roles
// =============================================================================

export const adminRoleCommands = {
  groupDescription: "Role management commands",
  set: {
    description: "Set an internal role mapping",
    optionInternalRole: "The internal role to map",
    optionServerRole: "The server role to assign",
    success: {
      title: "Role Mapping Updated",
      description: (roleType: string, roleString: string) =>
        `Mapped internal role **${roleType}** to server role ${roleString}`,
    },
    errors: {
      title: "Error",
      description: "An error occurred while setting the role mapping.",
    },
  },
  summary: {
    description: "Show role mappings summary",
    title: "Role Mappings Summary",
    line: (type: string, roleMention: string) => `**${type}**: ${roleMention}`,
    unassigned: "*Unassigned*",
  },
}

// =============================================================================
// COMMANDS - Admin Sessions
// =============================================================================

export const adminSessionCommands = {
  groupDescription: "Manage sessions",
  list: {
    description: "List all active sessions",
    emptyState: {
      title: "Active Sessions",
      description: "There are no active sessions on this server.",
    },
    summaryTitle: "Active Sessions",
    sessionField: {
      title: (tutorDisplayName: string) => `Tutor: ${tutorDisplayName}`,
      body: (tutorId: string, queueName: string, startTimeSeconds: number, studentCount: number) =>
        `- **User:** <@${tutorId}>\n- **Queue:** ${queueName}\n- **Started:** <t:${startTimeSeconds}:R>\n- **Students Helped:** ${studentCount}`,
    },
  },
  terminateAll: {
    description: "Terminate ALL sessions on this server",
    emptyState: {
      title: "Terminate All Sessions",
      description: "No active sessions found on this server.",
    },
    success: {
      title: "Terminate All Sessions",
      description: (count: number) => `Successfully terminated **${count}** session(s) on this server.`,
    },
  },
  terminate: {
    description: "Terminate all sessions for a specific user",
    optionUser: "The user whose sessions to terminate",
    emptyState: {
      title: "Terminate Session",
      description: (userId: string) => `No active sessions found for <@${userId}>.`,
    },
    success: {
      title: "Terminate Session",
      description: (count: number, userId: string) => `Successfully terminated **${count}** session(s) for <@${userId}>.`,
    },
  },
}

// =============================================================================
// COMMANDS - Admin Statistics
// =============================================================================

export const adminStatsCommands = {
  server: {
    description: "Shows general server information and activity graphs",
    optionShowEmptyDays: "Whether or not to show empty days in graph",
    datasets: {
      memberJoinCount: "Member Join Count",
      memberVerifyCount: "Member Verify Count",
    },
    embed: {
      title: "Server Stats",
      description: "Server Information",
      fields: {
        members: "❯ Members: ",
        verifiedMembers: "❯ Verified Members: ",
        unverifiedMembers: "❯ Unverified Members: ",
        channels: "❯ Channels: ",
        owner: "❯ Owner: ",
        createdAt: "❯ Created at: ",
      },
    },
  },
  sessions: {
    description: "Shows statistics about tutoring sessions and queues",
    datasetLabel: "Total Students",
    charts: {
      queuePopularity: "Queue Popularity (Students Tutored)",
      studentActivity: "Student Activity by Hour & Day",
    },
    days: {
      monday: "Monday",
      tuesday: "Tuesday",
      wednesday: "Wednesday",
      thursday: "Thursday",
      friday: "Friday",
      saturday: "Saturday",
      sunday: "Sunday",
    },
    embed: {
      sessionStats: {
        title: "Session Statistics",
        description: (totalStudents: number) => `Total Students Tutored: **${totalStudents}**`,
      },
      weeklyActivity: {
        title: "Weekly Activity",
        description: "Student count by day of the week and hour.",
      },
    },
  },
}

// =============================================================================
// COMMANDS - Admin User Management
// =============================================================================

export const adminUserCommands = {
  decryptToken: {
    description: "Decrypt a token to view its contents",
    optionToken: "The encrypted token to decrypt",
    invalidToken: {
      title: "❌ Invalid Token",
      description: "The provided token could not be decrypted or is invalid",
    },
    success: {
      title: "🔓 Decrypted Token",
      fields: {
        serverId: "Server ID",
        versionId: "Version ID",
        tuId: "TU ID",
        moodleId: "Moodle ID",
        roles: "Roles",
      },
      notSet: "Not set",
      footer: "⚠️ Keep token information confidential",
    },
    failure: {
      title: "❌ Decryption Failed",
      description: "An error occurred while decrypting the token",
    },
  },
  memberLookup: {
    description: "Look up information about a verified user",
    optionUser: "The user to look up",
    missingMember: {
      title: "❌ User Not Found",
      description: "This user is not a member of this server",
    },
    success: {
      title: "👤 User Information",
      fields: {
        discordUser: "Discord User",
        tuId: "TU ID",
        moodleId: "Moodle ID",
        verifiedAt: "Verified At",
      },
      notAvailable: "Not available",
      unknown: "Unknown",
    },
    errors: {
      default: "An error occurred while looking up user information",
      notVerified: "❌ This user is not verified on this server.",
      notInGuild: "❌ This user is not a member of this server.",
      title: "Lookup Failed",
    },
  },
  search: {
    description: "Search for a user by their ID",
    choices: {
      discordId: "Discord ID",
      tuId: "TU ID",
      moodleId: "Moodle ID",
    },
    optionIdType: "The type of ID to search by",
    optionIdValue: "The ID value to search for",
    success: {
      title: "🔍 Search Results",
      fields: {
        discordId: "Discord ID",
        discordUser: "Discord User",
        tuId: "TU ID",
        moodleId: "Moodle ID",
        verifiedAt: "Verified At",
      },
      notAvailable: "Not available",
      unknown: "Unknown",
    },
    errors: {
      default: "An error occurred while searching",
      notFound: "❌ No user found with the specified ID.",
      title: "Search Failed",
    },
  },
}
