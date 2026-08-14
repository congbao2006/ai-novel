import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { sendApplicationError, ServiceUnavailableError } from "../../errors.js";
import { getRequiredUser, requireUser } from "../auth/request-context.js";

const createSessionSchema = z.object({
  storyId: z.uuid(),
  characterId: z.uuid()
});

const sessionParamsSchema = z.object({
  id: z.uuid()
});

const submitTurnSchema = z.object({
  action: z.string().max(2000)
});

export const registerSessionsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", { preHandler: requireUser }, async (request) => {
    const sessionService = app.dependencies.sessionService;

    if (!sessionService) {
      throw new ServiceUnavailableError("Session service is unavailable.");
    }

    return sessionService.listSessions(getRequiredUser(request));
  });

  app.post("/", { preHandler: requireUser }, async (request, reply) => {
    const sessionService = app.dependencies.sessionService;

    if (!sessionService) {
      throw new ServiceUnavailableError("Session service is unavailable.");
    }

    const input = createSessionSchema.parse(request.body);
    const result = await sessionService.createSession(
      getRequiredUser(request),
      input
    );

    return reply.code(201).send(result);
  });

  app.post("/:id/turns", { preHandler: requireUser }, async (request) => {
    const gameplayService = app.dependencies.gameplayService;

    if (!gameplayService) {
      throw new ServiceUnavailableError("Gameplay service is unavailable.");
    }

    const params = sessionParamsSchema.parse(request.params);
    const input = submitTurnSchema.parse(request.body);

    return gameplayService.submitTurn(getRequiredUser(request), params.id, input);
  });

  app.get("/:id", { preHandler: requireUser }, async (request) => {
    const sessionService = app.dependencies.sessionService;

    if (!sessionService) {
      throw new ServiceUnavailableError("Session service is unavailable.");
    }

    const params = sessionParamsSchema.parse(request.params);
    return sessionService.getSession(getRequiredUser(request), params.id);
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.warn(
      { errorName: error instanceof Error ? error.name : "unknown" },
      "session route error"
    );

    return sendApplicationError(error, reply);
  });
};
