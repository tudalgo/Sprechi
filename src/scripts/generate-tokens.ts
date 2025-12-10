import { encryptTokenString } from "@utils/token"
import { InternalRole } from "@db/schema"
import { parse } from "csv-parse"
import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"
import dotenv from "dotenv"
import logger from "@utils/logger"

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load the .env file
dotenv.config()

type Student = {
  id_tu: string
  id_moodle: string
}

type TokenResult = {
  moodleId: string
  token: string
}

(async () => {
  const csvFilePath = path.resolve(__dirname, "../../report.csv")

  if (!fs.existsSync(csvFilePath)) {
    logger.error(`Error: CSV file not found at ${csvFilePath}`)
    logger.info("Please create a report.csv file in the project root with columns: id_tu, id_moodle")
    process.exit(1)
  }

  const headers = ["id_tu", "id_moodle"]
  const fileContent = fs.readFileSync(csvFilePath, { encoding: "utf-8" })

  // Read existing tokens from backup file
  const oldResultFilePath = path.resolve(__dirname, "../../result.json.bak")
  let oldMoodleIds: string[] = []
  let oldResults: TokenResult[] = []

  if (fs.existsSync(oldResultFilePath)) {
    const oldResultFileContent = fs.readFileSync(oldResultFilePath, { encoding: "utf-8" })
    oldResults = JSON.parse(oldResultFileContent) as TokenResult[]
    oldMoodleIds = oldResults.map(x => x.moodleId)
    logger.info(`Loaded ${oldMoodleIds.length} existing tokens from backup`)
  }

  // Parse CSV
  const parser = parse(fileContent, {
    delimiter: ",",
    columns: headers,
    from_line: 2, // Skip header row
  })

  const students: Student[] = []
  for await (const record of parser) {
    students.push(record)
  }

  // Get server ID from environment or use default
  const serverId = process.env.SERVER_ID
  if (!serverId) {
    logger.error("Error: SERVER_ID environment variable is not set")
    process.exit(1)
  }
  if (!process.env.TOKEN_ENCRYPTION_SECRET) {
    logger.error("Error: TOKEN_ENCRYPTION_SECRET environment variable is not set")
    process.exit(1)
  }
  const versionId = "01"

  // Generate tokens for new students
  const newResult = students
    .filter(student => !Number.isNaN(Number.parseInt(student.id_moodle, 10)))
    .filter(student => !oldMoodleIds.includes(student.id_moodle))
    .map((student) => {
      const token = encryptTokenString(
        serverId,
        versionId,
        student.id_tu,
        student.id_moodle,
        [InternalRole.Verified],
      )
      return {
        moodleId: student.id_moodle,
        token,
      }
    })

  logger.info(`Found ${newResult.length} new students to generate tokens for`)

  // Write new results to result.json
  const resultFilePath = path.resolve(__dirname, "../../result.json")
  fs.writeFileSync(resultFilePath, JSON.stringify(newResult, null, 2))
  logger.info(`Wrote ${newResult.length} new tokens to result.json`)

  // Update backup file with all tokens (old + new)
  const allResults = [...oldResults, ...newResult]
  fs.writeFileSync(oldResultFilePath, JSON.stringify(allResults, null, 2))
  logger.info(`Updated backup file with ${allResults.length} total tokens`)

  logger.info("\nToken generation complete!")
  logger.info(`- New tokens: ${newResult.length}`)
  logger.info(`- Total tokens: ${allResults.length}`)
})()
