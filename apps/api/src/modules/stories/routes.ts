import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { sendApplicationError, ServiceUnavailableError } from "../../errors.js";

const listStoriesQuerySchema = z.object({
  genre: z.string().trim().min(1).max(80).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  page: z.coerce.number().int().min(1).default(1)
});

const storyParamsSchema = z.object({
  slug: z.string().trim().min(1).max(120)
});

export const registerStoriesRoutes: FastifyPluginAsync = async (app) => {
  app.get("/", async (request) => {
    const storyService = app.dependencies.storyService;

    if (!storyService) {
      throw new ServiceUnavailableError("Story service is unavailable.");
    }

    const query = listStoriesQuerySchema.parse(request.query);
    return storyService.listPublished(query);
  });

  app.get("/:slug", async (request) => {
    const storyService = app.dependencies.storyService;

    if (!storyService) {
      throw new ServiceUnavailableError("Story service is unavailable.");
    }

    const params = storyParamsSchema.parse(request.params);
    return storyService.getBySlug(params.slug);
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.warn(
      { errorName: error instanceof Error ? error.name : "unknown" },
      "story route error"
    );

    return sendApplicationError(error, reply, request.id, app.appConfig.nodeEnv);
  });
};
