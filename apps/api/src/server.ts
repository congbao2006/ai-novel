import { getServerConfig } from "@ai-novel/config";
import { buildApp } from "./app.js";

const config = getServerConfig();
const app = await buildApp();

try {
  await app.listen({
    host: config.api.host,
    port: config.api.port
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
