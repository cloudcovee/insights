import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cwd = process.cwd();

// Resolve both root and inner directory paths regardless of where cwd is
let rootDir = cwd;
if (path.basename(cwd) === "insights-main" && fs.existsSync(path.resolve(cwd, "..", "local-collections.json"))) {
  rootDir = path.resolve(cwd, "..");
}

const rootSrc = path.resolve(rootDir, "src");
const innerSrc = path.resolve(rootDir, "insights-main", "src");

if (fs.existsSync(rootSrc) && fs.existsSync(innerSrc)) {
  try {
    fs.cpSync(rootSrc, innerSrc, { recursive: true, force: true });
    console.log("✓ Synchronized root src -> insights-main/src");
  } catch (err) {
    console.error("Sync error:", err);
  }
}

// Sync local json data files
const jsonFiles = [
  "local-collections.json",
  "local-collection-data.json",
  "local-events.json",
  "local-profiles.json",
  "local-sessions.json",
  "local-sitemaps.json",
  "local-apikeys.json",
];

for (const file of jsonFiles) {
  const rootFile = path.resolve(rootDir, file);
  const innerFile = path.resolve(rootDir, "insights-main", file);
  try {
    if (fs.existsSync(rootFile) && fs.existsSync(innerFile)) {
      const rootStat = fs.statSync(rootFile);
      const innerStat = fs.statSync(innerFile);
      if (rootStat.mtimeMs >= innerStat.mtimeMs) {
        fs.copyFileSync(rootFile, innerFile);
      } else {
        fs.copyFileSync(innerFile, rootFile);
      }
    } else if (fs.existsSync(rootFile)) {
      fs.copyFileSync(rootFile, innerFile);
    } else if (fs.existsSync(innerFile)) {
      fs.copyFileSync(innerFile, rootFile);
    }
  } catch (err) {
    console.error(`Error syncing ${file}:`, err);
  }
}

