import { getServerConfig } from "@ai-novel/config";
import {
  createRepositories,
  getDatabaseClient
} from "@ai-novel/db";
import { buildApp } from "./app.js";
import { Argon2PasswordHasher } from "./modules/auth/password.js";
import { AuthService } from "./modules/auth/service.js";
import { SessionService } from "./modules/sessions/service.js";
import { StoryService } from "./modules/stories/service.js";

const config = getServerConfig();
const database = config.database.url ? getDatabaseClient(config.database.url) : undefined;
const repositories = config.database.url
  ? createRepositories(database!)
  : undefined;
const authService = repositories
  ? new AuthService({
      repositories,
      passwordHasher: new Argon2PasswordHasher(),
      sessionTtlSeconds: config.auth.sessionTtlSeconds
    })
  : undefined;
const storyService = repositories ? new StoryService(repositories) : undefined;
const sessionService = repositories
  ? new SessionService(repositories, database)
  : undefined;
const dependencies = {
  ...(repositories ? { repositories } : {}),
  ...(authService ? { authService } : {}),
  ...(storyService ? { storyService } : {}),
  ...(sessionService ? { sessionService } : {})
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
