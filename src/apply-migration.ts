import { migrateDb } from "./migrate"
import * as dotenv from "dotenv"
import * as path from "path"
import { dirname } from "path"
import { fileURLToPath } from "url"
import logger from "@utils/logger"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, "../.env.dev") })

export async function run() {
  try {
    await migrateDb()
    logger.info("Migration complete")
    process.exit(0)
  } catch (err) {
    logger.error("Migration failed", err)
    process.exit(1)
  }
}

if (process.argv[1] === __filename) {
  void run()
}
