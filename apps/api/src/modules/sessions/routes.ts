import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  getErrorLogDetails,
  isExpectedRequestError,
  sendApplicationError,
  ServiceUnavailableError
} from "../../errors.js";
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

  app.post(
    "/:id/turns",
    {
      preHandler: requireUser,
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } }
    },
    async (request) => {
    const gameplayService = app.dependencies.gameplayService;

    if (!gameplayService) {
      throw new ServiceUnavailableError("Gameplay service is unavailable.");
    }

    const params = sessionParamsSchema.parse(request.params);
    const input = submitTurnSchema.parse(request.body);

    return gameplayService.submitTurn(getRequiredUser(request), params.id, input);
  });

  app.get("/:id/quests", { preHandler: requireUser }, async (request) => {
    const sessionService = app.dependencies.sessionService;

    if (!sessionService) {
      throw new ServiceUnavailableError("Session service is unavailable.");
    }

    const params = sessionParamsSchema.parse(request.params);
    return sessionService.listSessionQuests(getRequiredUser(request), params.id);
  });

  app.get("/:id/inventory", { preHandler: requireUser }, async (request) => {
    const sessionService = app.dependencies.sessionService;

    if (!sessionService) {
      throw new ServiceUnavailableError("Session service is unavailable.");
    }

    const params = sessionParamsSchema.parse(request.params);
    return sessionService.listPlayerInventory(getRequiredUser(request), params.id);
  });

  app.get("/:id/factions", { preHandler: requireUser }, async (request) => {
    const sessionService = app.dependencies.sessionService;

    if (!sessionService) {
      throw new ServiceUnavailableError("Session service is unavailable.");
    }

    const params = sessionParamsSchema.parse(request.params);
    return sessionService.listSessionFactions(getRequiredUser(request), params.id);
  });

  app.post("/:id/world-tick", { preHandler: requireUser }, async (request) => {
    const sessionService = app.dependencies.sessionService;
    const worldSimulationService = app.dependencies.worldSimulationService;

    if (!sessionService || !worldSimulationService) {
      throw new ServiceUnavailableError("World simulation service is unavailable.");
    }

    const params = sessionParamsSchema.parse(request.params);
    const user = getRequiredUser(request);
    const session = await sessionService.getSession(user, params.id);
    const result = await worldSimulationService.runIfDue({
      userId: user.userId,
      sessionId: params.id,
      turnNumber: session.turnCount,
      reason: "manual"
    });

    return {
      triggered: result.triggered,
      skippedReason: result.skippedReason,
      factionsChanged: result.factionsChanged,
      rulesApplied: result.rulesApplied,
      events: result.events.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        title: event.title,
        description: event.description,
        importance: event.importance,
        turnNumber: event.turnNumber,
        createdAt: event.createdAt.toISOString()
      }))
    };
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
    const details = getErrorLogDetails(error, {
      requestId: request.id,
      method: request.method,
      url: request.url
    });

    if (isExpectedRequestError(error)) {
      request.log.warn(details, "session route error");
    } else {
      request.log.error(details, "session route error");
    }

    return sendApplicationError(error, reply, request.id, app.appConfig.nodeEnv);
  });
};
