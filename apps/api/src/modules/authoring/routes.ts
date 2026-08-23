import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import {
  getErrorLogDetails,
  isExpectedRequestError,
  sendApplicationError,
  ServiceUnavailableError
} from "../../errors.js";
import { getRequiredUser, requireUser } from "../auth/request-context.js";

const storyParamsSchema = z.object({
  id: z.uuid()
});

const nestedParamsSchema = z.object({
  id: z.uuid(),
  childId: z.uuid()
});

const jsonObjectSchema = z.record(z.string(), z.unknown());

const createDraftSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2000),
  genre: z.string().trim().min(1).max(80),
  slug: z.string().trim().min(1).max(100).optional()
});

const updateStorySchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  slug: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().min(1).max(2000).optional(),
  genre: z.string().trim().min(1).max(80).optional(),
  worldPrompt: z.string().max(12000).optional(),
  openingPrompt: z.string().max(8000).optional(),
  settings: jsonObjectSchema.optional()
});

const characterSchema = z.object({
  type: z.enum(["playable", "npc"]),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2000),
  personality: z.string().max(2000).optional(),
  background: z.string().max(2000).optional(),
  goals: z.array(z.unknown()).optional(),
  secrets: jsonObjectSchema.optional(),
  initialStats: jsonObjectSchema.optional(),
  initialState: jsonObjectSchema.optional(),
  initialLocation: z.string().trim().max(160).nullable().optional(),
  metadata: jsonObjectSchema.optional()
});

const factionSchema = z.object({
  factionKey: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(2000),
  initialStatus: z
    .enum(["active", "weakened", "collapsed", "hidden"])
    .optional(),
  initialInfluence: z.number().int().min(0).max(100).optional(),
  resources: jsonObjectSchema.optional(),
  goals: z.array(z.unknown()).optional(),
  state: jsonObjectSchema.optional()
});

const abilitySchema = z.object({
  abilityKey: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(120),
  description: z.string().max(1000).optional(),
  category: z
    .enum(["movement", "combat", "perception", "social", "utility", "magic", "other"])
    .optional(),
  rank: z.number().int().min(1).max(20).optional(),
  resourceCost: jsonObjectSchema.nullable().optional(),
  cooldownTurns: z.number().int().min(0).max(20).optional(),
  tags: z.array(z.unknown()).optional(),
  effects: jsonObjectSchema.optional(),
  requirements: jsonObjectSchema.optional(),
  enabled: z.boolean().optional(),
  metadata: jsonObjectSchema.optional()
});

const abilityAssignmentSchema = z.object({
  abilityId: z.uuid(),
  rank: z.number().int().min(1).max(20).optional(),
  enabled: z.boolean().optional(),
  unlocked: z.boolean().optional()
});

export const registerAuthoringRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", requireUser);

  app.get("/stories", async (request) => {
    const service = app.dependencies.storyAuthoringService;
    if (!service) {
      throw new ServiceUnavailableError("Story authoring service is unavailable.");
    }
    return service.listOwned(getRequiredUser(request));
  });

  app.post("/stories", async (request, reply) => {
    const service = app.dependencies.storyAuthoringService;
    if (!service) {
      throw new ServiceUnavailableError("Story authoring service is unavailable.");
    }
    const result = await service.createDraft(
      getRequiredUser(request),
      createDraftSchema.parse(request.body)
    );
    return reply.code(201).send(result);
  });

  app.get("/stories/:id", async (request) => {
    const service = app.dependencies.storyAuthoringService;
    if (!service) {
      throw new ServiceUnavailableError("Story authoring service is unavailable.");
    }
    const params = storyParamsSchema.parse(request.params);
    return service.getOwnedStory(getRequiredUser(request), params.id);
  });

  app.get("/stories/:id/versions", async (request) => {
    const service = app.dependencies.storyAuthoringService;
    if (!service) {
      throw new ServiceUnavailableError("Story authoring service is unavailable.");
    }
    const params = storyParamsSchema.parse(request.params);
    return service.listVersions(getRequiredUser(request), params.id);
  });

  app.patch("/stories/:id", async (request) => {
    const service = app.dependencies.storyAuthoringService;
    if (!service) {
      throw new ServiceUnavailableError("Story authoring service is unavailable.");
    }
    const params = storyParamsSchema.parse(request.params);
    return service.updateStory(
      getRequiredUser(request),
      params.id,
      updateStorySchema.parse(request.body)
    );
  });

  app.post("/stories/:id/characters", async (request, reply) => {
    const service = app.dependencies.storyAuthoringService;
    if (!service) {
      throw new ServiceUnavailableError("Story authoring service is unavailable.");
    }
    const params = storyParamsSchema.parse(request.params);
    const result = await service.createCharacter(
      getRequiredUser(request),
      params.id,
      characterSchema.parse(request.body)
    );
    return reply.code(201).send(result);
  });

  app.patch("/stories/:id/characters/:childId", async (request) => {
    const service = app.dependencies.storyAuthoringService;
    if (!service) {
      throw new ServiceUnavailableError("Story authoring service is unavailable.");
    }
    const params = nestedParamsSchema.parse(request.params);
    return service.updateCharacter(
      getRequiredUser(request),
      params.id,
      params.childId,
      characterSchema.parse(request.body)
    );
  });

  app.delete("/stories/:id/characters/:childId", async (request, reply) => {
    const service = app.dependencies.storyAuthoringService;
    if (!service) {
      throw new ServiceUnavailableError("Story authoring service is unavailable.");
    }
    const params = nestedParamsSchema.parse(request.params);
    await service.deleteCharacter(getRequiredUser(request), params.id, params.childId);
    return reply.code(204).send();
  });

  app.post("/stories/:id/abilities", async (request, reply) => {
    const service = app.dependencies.storyAuthoringService;
    if (!service) {
      throw new ServiceUnavailableError("Story authoring service is unavailable.");
    }
    const params = storyParamsSchema.parse(request.params);
    const result = await service.createAbility(
      getRequiredUser(request),
      params.id,
      abilitySchema.parse(request.body)
    );
    return reply.code(201).send(result);
  });

  app.patch("/stories/:id/abilities/:childId", async (request) => {
    const service = app.dependencies.storyAuthoringService;
    if (!service) {
      throw new ServiceUnavailableError("Story authoring service is unavailable.");
    }
    const params = nestedParamsSchema.parse(request.params);
    return service.updateAbility(
      getRequiredUser(request),
      params.id,
      params.childId,
      abilitySchema.parse(request.body)
    );
  });

  app.delete("/stories/:id/abilities/:childId", async (request, reply) => {
    const service = app.dependencies.storyAuthoringService;
    if (!service) {
      throw new ServiceUnavailableError("Story authoring service is unavailable.");
    }
    const params = nestedParamsSchema.parse(request.params);
    await service.deleteAbility(getRequiredUser(request), params.id, params.childId);
    return reply.code(204).send();
  });

  app.post("/stories/:id/characters/:childId/abilities", async (request) => {
    const service = app.dependencies.storyAuthoringService;
    if (!service) {
      throw new ServiceUnavailableError("Story authoring service is unavailable.");
    }
    const params = nestedParamsSchema.parse(request.params);
    return service.assignAbilityToCharacter(
      getRequiredUser(request),
      params.id,
      params.childId,
      abilityAssignmentSchema.parse(request.body)
    );
  });

  app.delete(
    "/stories/:id/characters/:childId/abilities/:abilityId",
    async (request, reply) => {
      const service = app.dependencies.storyAuthoringService;
      if (!service) {
        throw new ServiceUnavailableError("Story authoring service is unavailable.");
      }
      const params = z
        .object({ id: z.uuid(), childId: z.uuid(), abilityId: z.uuid() })
        .parse(request.params);
      await service.removeAbilityFromCharacter(
        getRequiredUser(request),
        params.id,
        params.childId,
        params.abilityId
      );
      return reply.code(204).send();
    }
  );

  app.post("/stories/:id/factions", async (request, reply) => {
    const service = app.dependencies.storyAuthoringService;
    if (!service) {
      throw new ServiceUnavailableError("Story authoring service is unavailable.");
    }
    const params = storyParamsSchema.parse(request.params);
    const result = await service.createFaction(
      getRequiredUser(request),
      params.id,
      factionSchema.parse(request.body)
    );
    return reply.code(201).send(result);
  });

  app.patch("/stories/:id/factions/:childId", async (request) => {
    const service = app.dependencies.storyAuthoringService;
    if (!service) {
      throw new ServiceUnavailableError("Story authoring service is unavailable.");
    }
    const params = nestedParamsSchema.parse(request.params);
    return service.updateFaction(
      getRequiredUser(request),
      params.id,
      params.childId,
      factionSchema.parse(request.body)
    );
  });

  app.delete("/stories/:id/factions/:childId", async (request, reply) => {
    const service = app.dependencies.storyAuthoringService;
    if (!service) {
      throw new ServiceUnavailableError("Story authoring service is unavailable.");
    }
    const params = nestedParamsSchema.parse(request.params);
    await service.deleteFaction(getRequiredUser(request), params.id, params.childId);
    return reply.code(204).send();
  });

  app.post("/stories/:id/validate", async (request) => {
    const service = app.dependencies.storyAuthoringService;
    if (!service) {
      throw new ServiceUnavailableError("Story authoring service is unavailable.");
    }
    const params = storyParamsSchema.parse(request.params);
    return service.validateForPublish(getRequiredUser(request), params.id);
  });

  app.post("/stories/:id/publish", async (request) => {
    const service = app.dependencies.storyAuthoringService;
    if (!service) {
      throw new ServiceUnavailableError("Story authoring service is unavailable.");
    }
    const params = storyParamsSchema.parse(request.params);
    return service.publish(getRequiredUser(request), params.id);
  });

  app.post("/stories/:id/revisions", async (request) => {
    const service = app.dependencies.storyAuthoringService;
    if (!service) {
      throw new ServiceUnavailableError("Story authoring service is unavailable.");
    }
    const params = storyParamsSchema.parse(request.params);
    return service.createRevision(getRequiredUser(request), params.id);
  });

  app.post("/stories/:id/archive", async (request) => {
    const service = app.dependencies.storyAuthoringService;
    if (!service) {
      throw new ServiceUnavailableError("Story authoring service is unavailable.");
    }
    const params = storyParamsSchema.parse(request.params);
    return service.archive(getRequiredUser(request), params.id);
  });

  app.setErrorHandler((error, request, reply) => {
    const logDetails = getErrorLogDetails(error, {
      requestId: request.id,
      method: request.method,
      url: request.url
    });

    if (isExpectedRequestError(error)) {
      request.log.warn(logDetails, "authoring route error");
    } else {
      request.log.error(logDetails, "unexpected authoring route error");
    }

    return sendApplicationError(error, reply, request.id, app.appConfig.nodeEnv);
  });
};
