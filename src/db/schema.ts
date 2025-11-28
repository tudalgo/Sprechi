import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
  boolean,
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
  waitingRoomId: text("waiting_room_id"),
  logChannelId: text("log_channel_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, table => [
  index("queues_guild_id_idx").on(table.guildId),
  uniqueIndex("queues_guild_name_idx").on(table.guildId, table.name),
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
