import { migrateDb } from "./migrate";
import * as dotenv from "dotenv";
import * as path from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env.dev") });


migrateDb().then(() => {
    console.log("Migration complete");
    process.exit(0);
}).catch((err) => {
    console.error("Migration failed", err);
    process.exit(1);
});
