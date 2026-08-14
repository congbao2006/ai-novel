import { getServerConfig } from "@ai-novel/config";
import {
  createRepositories,
  getDatabaseClient
} from "@ai-novel/db";
import { buildApp } from "./app.js";
import { Argon2PasswordHasher } from "./modules/auth/password.js";
import { AuthService } from "./modules/auth/service.js";

const config = getServerConfig();
const repositories = config.database.url
  ? createRepositories(getDatabaseClient(config.database.url))
  : undefined;
const authService = repositories
  ? new AuthService({
      repositories,
      passwordHasher: new Argon2PasswordHasher(),
      sessionTtlSeconds: config.auth.sessionTtlSeconds
    })
  : undefined;
const dependencies = {
  ...(repositories ? { repositories } : {}),
  ...(authService ? { authService } : {})
};
const app = await buildApp({
  dependencies
});

try {
  await app.listen({
    host: config.api.host,
    port: config.api.port
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
