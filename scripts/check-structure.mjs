import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const requiredFiles = [
  "AGENTS.md",
  "ARCHITECTURE.md",
  "docs/PRODUCT.md",
  "docs/DATABASE.md",
  "docs/AI_ENGINE.md",
  "docs/MEMORY.md",
  "docs/ROADMAP.md",
  ".gitignore",
  ".env.example",
  "package.json",
  "pnpm-workspace.yaml",
  "tsconfig.base.json"
];

const requiredDirs = [
  "apps/web",
  "apps/api",
  "packages/domain",
  "packages/ai-engine",
  "packages/db",
  "packages/config",
  "scripts"
];

const missing = [];

for (const file of requiredFiles) {
  const path = join(root, file);
  if (!existsSync(path) || !statSync(path).isFile()) {
    missing.push(file);
  }
}

for (const dir of requiredDirs) {
  const path = join(root, dir);
  if (!existsSync(path) || !statSync(path).isDirectory()) {
    missing.push(dir);
  }
}

if (missing.length > 0) {
  console.error("Missing required project structure:");
  for (const item of missing) {
    console.error(`- ${item}`);
  }
  process.exit(1);
}

console.log("Project structure check passed.");
