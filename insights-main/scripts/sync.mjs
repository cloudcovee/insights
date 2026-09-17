import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cwd = process.cwd();
const localSrc = path.resolve(cwd, "src");
const rootSrc = path.resolve(cwd, "..", "src");

if (fs.existsSync(localSrc) && fs.existsSync(rootSrc)) {
  try {
    fs.cpSync(localSrc, rootSrc, { recursive: true, force: true });
    console.log("✓ Synchronized inner src -> root src");
  } catch (err) {
    console.error("Sync error:", err);
  }
}
