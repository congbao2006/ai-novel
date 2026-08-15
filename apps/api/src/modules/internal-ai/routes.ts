import type { FastifyPluginAsync } from "fastify";
import { getServerConfig } from "@ai-novel/config";
import { z } from "zod";
import { sendApplicationError, ServiceUnavailableError } from "../../errors.js";

const smokeSchema = z.object({
  prompt: z.string().trim().min(1).max(500)
});

export const registerInternalAiRoutes: FastifyPluginAsync = async (app) => {
  app.post("/smoke", async (request) => {
    const config = getServerConfig();

    if (
      config.nodeEnv === "production" &&
      !config.ai.internalSmokeEnabled
    ) {
      throw new ServiceUnavailableError("Internal AI smoke endpoint is disabled.");
    }

    const aiGateway = app.dependencies.aiGateway;

    if (!aiGateway) {
      throw new ServiceUnavailableError("AI gateway is unavailable.");
    }

    const input = smokeSchema.parse(request.body);
    const result = await aiGateway.generate({
      feature: "internal.ai.smoke",
      input: input.prompt,
      instructions: "Reply concisely and follow the user's exact instruction.",
      metadata: {
        purpose: "smoke",
        route: "internal.ai.smoke"
      }
    });

    return {
      text: result.text,
      provider: result.provider,
      model: result.model,
      usage: result.usage,
      latencyMs: result.latencyMs,
      requestId: result.requestId,
      estimatedCostMicros: result.estimatedCostMicros
    };
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.warn(
      { errorName: error instanceof Error ? error.name : "unknown" },
      "internal ai route error"
    );

    return sendApplicationError(error, reply);
  });
};
