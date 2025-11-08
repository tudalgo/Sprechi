import { drizzle } from "drizzle-orm/node-postgres"
import logger from "@utils/logger"
import { migrate } from "drizzle-orm/node-postgres/migrator"
import * as path from "path"
import { exit } from "process"
import { Client } from "pg"
import * as schema from "@db/schema"

export async function migrateDb(): Promise<void> {
  const migrationsPath = path.resolve("src/db/migrations")
  let client: Client | undefined

  try {
    logger.info("Migrating database...")
    logger.debug(`Migrations path: ${migrationsPath}`)

    client = new Client({
      connectionString: process.env.DATABASE_URL!,
    })

    await client.connect()
    const migrationDb = drizzle(client, { schema })
    await migrate(migrationDb, { migrationsFolder: migrationsPath })

    logger.info("Database migrated successfully.")
  } catch (error) {
    logger.error("Database migration error:", error)
    exit(1)
  } finally {
    if (client) {
      await client.end()
      logger.debug("Migration client connection closed.")
    }
  }
}
