import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cwd = process.cwd();
const rootSrc = path.resolve(cwd, "src");
const innerSrc = path.resolve(cwd, "insights-main", "src");

if (fs.existsSync(rootSrc) && fs.existsSync(innerSrc)) {
  try {
    fs.cpSync(innerSrc, rootSrc, { recursive: true, force: true });
    console.log("✓ Synchronized insights-main/src -> root src");
  } catch (err) {
    console.error("Sync error:", err);
  }
}
