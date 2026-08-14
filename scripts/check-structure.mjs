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
  "tsconfig.base.json",
  "eslint.config.mjs",
  "apps/web/package.json",
  "apps/web/tsconfig.json",
  "apps/web/next.config.ts",
  "apps/web/postcss.config.mjs",
  "apps/web/src/app/layout.tsx",
  "apps/web/src/app/page.tsx",
  "apps/web/src/app/login/page.tsx",
  "apps/web/src/app/register/page.tsx",
  "apps/web/src/app/globals.css",
  "apps/web/src/components/auth-form.tsx",
  "apps/web/src/components/auth-status.tsx",
  "apps/web/src/lib/api.ts",
  "apps/api/package.json",
  "apps/api/tsconfig.json",
  "apps/api/tsconfig.build.json",
  "apps/api/vitest.config.ts",
  "apps/api/src/app.ts",
  "apps/api/src/dependencies.ts",
  "apps/api/src/server.ts",
  "apps/api/src/modules/health/routes.ts",
  "apps/api/src/modules/auth/cookies.ts",
  "apps/api/src/modules/auth/dto.ts",
  "apps/api/src/modules/auth/errors.ts",
  "apps/api/src/modules/auth/password.ts",
  "apps/api/src/modules/auth/request-context.ts",
  "apps/api/src/modules/auth/routes.ts",
  "apps/api/src/modules/auth/service.ts",
  "apps/api/src/modules/auth/tokens.ts",
  "packages/domain/package.json",
  "packages/domain/tsconfig.build.json",
  "packages/domain/src/index.ts",
  "packages/ai-engine/package.json",
  "packages/ai-engine/tsconfig.build.json",
  "packages/ai-engine/src/index.ts",
  "packages/db/package.json",
  "packages/db/tsconfig.build.json",
  "packages/db/vitest.config.ts",
  "packages/db/drizzle.config.ts",
  "packages/db/drizzle/0000_thin_loki.sql",
  "packages/db/drizzle/0001_high_starhawk.sql",
  "packages/db/src/index.ts",
  "packages/db/src/schema/enums.ts",
  "packages/db/src/schema/identity.ts",
  "packages/db/src/schema/stories.ts",
  "packages/db/src/schema/gameplay.ts",
  "packages/db/src/schema/index.ts",
  "packages/db/src/seed/development.ts",
  "packages/db/src/seed/run-development.ts",
  "packages/db/src/repositories/contracts.ts",
  "packages/db/src/repositories/context.ts",
  "packages/db/src/repositories/errors.ts",
  "packages/db/src/repositories/factory.ts",
  "packages/db/src/repositories/helpers.ts",
  "packages/db/src/repositories/implementations.ts",
  "packages/db/src/repositories/index.ts",
  "packages/db/src/repositories/types.ts",
  "packages/config/package.json",
  "packages/config/tsconfig.build.json",
  "packages/config/src/index.ts",
  "packages/config/src/server.ts",
  "packages/config/src/public.ts"
];

const requiredDirs = [
  "apps/web",
  "apps/api",
  "apps/api/src/modules/auth",
  "apps/api/src/modules/stories",
  "apps/api/src/modules/sessions",
  "apps/api/src/modules/gameplay",
  "apps/api/src/modules/ai",
  "apps/api/src/modules/users",
  "packages/domain",
  "packages/ai-engine",
  "packages/db",
  "packages/db/drizzle",
  "packages/db/drizzle/meta",
  "packages/db/src/repositories",
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
