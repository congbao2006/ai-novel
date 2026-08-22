import type { FastifyPluginAsync } from "fastify";
import { checkDatabaseReadiness } from "@ai-novel/db";

export const registerHealthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => ({
    status: "ok"
  }));

  app.get("/ready", async (request, reply) => {
    const database = app.dependencies.database;

    if (!database) {
      request.log.warn("readiness failed: database client is unavailable");

      return reply.code(503).send({
        status: "error",
        requestId: request.id,
        checks: {
          database: "unavailable",
          pgvector: app.appConfig.memory.semanticSearchEnabled
            ? "unavailable"
            : "skipped"
        }
      });
    }

    try {
      const checks = await checkDatabaseReadiness(database, {
        requirePgVector: app.appConfig.memory.semanticSearchEnabled
      });

      return {
        status: "ok",
        checks
      };
    } catch (error) {
      request.log.warn(
        {
          requestId: request.id,
          errorName: error instanceof Error ? error.name : "unknown"
        },
        "readiness failed"
      );

      return reply.code(503).send({
        status: "error",
        requestId: request.id,
        checks: {
          database: "unavailable",
          pgvector: app.appConfig.memory.semanticSearchEnabled
            ? "unavailable"
            : "skipped"
        }
      });
    }
  });
};
