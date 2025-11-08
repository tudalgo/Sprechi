import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  index,
  uniqueIndex,
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
  limit: integer("limit"),
  disconnectTimeout: integer("disconnect_timeout"),
  matchTimeout: integer("match_timeout"),
  joinMessage: text("join_message"),
  matchFoundMessage: text("match_found_message"),
  timeoutMessage: text("timeout_message"),
  leaveMessage: text("leave_message"),
  leaveRoomMessage: text("leave_room_message"),
  textChannel: text("text_channel"),
  locked: boolean("locked").default(false).notNull(),
  autoLock: boolean("auto_lock").default(false).notNull(),
  openShift: integer("open_shift").default(0).notNull(),
  closeShift: integer("close_shift").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, table => [
  index("queues_guild_id_idx").on(table.guildId),
  uniqueIndex("queues_guild_name_idx").on(table.guildId, table.name),
])
