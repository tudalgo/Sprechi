import {
  pgTable,
  uuid,
  text,
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, table => [
  index("queues_guild_id_idx").on(table.guildId),
  uniqueIndex("queues_guild_name_idx").on(table.guildId, table.name),
])
