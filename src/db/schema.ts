import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core"

// Guilds Table
export const guilds = pgTable("guilds", {
  id: text("id").primaryKey(), // Discord Guild ID
  name: text("name").notNull(),
  memberCount: integer("member_count").default(0).notNull(),
  welcomeText: text("welcome_text"),
  welcomeTitle: text("welcome_title"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, table => [
  index("guilds_name_idx").on(table.name),
  index("guilds_member_count_idx").on(table.memberCount),
])

// Queues Table
export const queues = pgTable("queues", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  guildId: text("guild_id").references(() => guilds.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  isLocked: boolean("is_locked").default(false).notNull(),
  scheduleEnabled: boolean("schedule_enabled").default(false).notNull(),
  scheduleShiftMinutes: integer("schedule_shift_minutes").default(0).notNull(),
  waitingRoomId: text("waiting_room_id"),
  privateLogChannelId: text("private_log_channel_id"),
  publicLogChannelId: text("public_log_channel_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, table => [
  index("queues_guild_id_idx").on(table.guildId),
  uniqueIndex("queues_guild_name_idx").on(table.guildId, table.name),
])

export const queueSchedules = pgTable("queue_schedules", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  queueId: uuid("queue_id").references(() => queues.id, { onDelete: "cascade" }).notNull(),
  dayOfWeek: integer("day_of_week").notNull(), // 0=Sunday, 6=Saturday
  startTime: text("start_time").notNull(), // HH:mm
  endTime: text("end_time").notNull(), // HH:mm
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, table => [
  index("queue_schedules_queue_id_idx").on(table.queueId),
  uniqueIndex("queue_schedules_queue_day_idx").on(table.queueId, table.dayOfWeek),
])

export const queueMembers = pgTable("queue_members", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  queueId: uuid("queue_id").references(() => queues.id, { onDelete: "cascade" }).notNull(),
  userId: text("user_id").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  leftAt: timestamp("left_at"),
}, table => [
  uniqueIndex("queue_members_queue_user_idx").on(table.queueId, table.userId),
  index("queue_members_queue_id_idx").on(table.queueId),
])

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  queueId: uuid("queue_id").references(() => queues.id, { onDelete: "cascade" }).notNull(),
  tutorId: text("tutor_id").notNull(),
  startTime: timestamp("start_time").defaultNow().notNull(),
  endTime: timestamp("end_time"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, table => [
  index("sessions_queue_id_idx").on(table.queueId),
  index("sessions_tutor_id_idx").on(table.tutorId),
])

export const sessionStudents = pgTable("session_students", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  sessionId: uuid("session_id").references(() => sessions.id, { onDelete: "cascade" }).notNull(),
  studentId: text("student_id").notNull(),
  channelId: text("channel_id"),
  startTime: timestamp("start_time").defaultNow().notNull(),
  endTime: timestamp("end_time"),
}, table => [
  index("session_students_session_id_idx").on(table.sessionId),
  index("session_students_student_id_idx").on(table.studentId),
  index("session_students_channel_id_idx").on(table.channelId),
])

// Role Mappings Table
export enum InternalRole {
  Admin = "admin",
  Tutor = "tutor",
  Verified = "verified",
  ActiveSession = "active_session",
}

export const internalRoleEnum = pgEnum("internal_role", [
  InternalRole.Admin,
  InternalRole.Tutor,
  InternalRole.Verified,
  InternalRole.ActiveSession,
])

export const roleMappings = pgTable("role_mappings", {
  guildId: text("guild_id").references(() => guilds.id, { onDelete: "cascade" }).notNull(),
  roleType: internalRoleEnum("role_type").notNull(), // admin, tutor, verified, active_session
  roleId: text("role_id").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, table => [
  uniqueIndex("role_mappings_guild_type_idx").on(table.guildId, table.roleType),
  index("role_mappings_guild_id_idx").on(table.guildId),
])
