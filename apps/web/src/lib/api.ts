export const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type CurrentUser = {
  readonly userId: string;
  readonly email: string;
  readonly displayName: string;
};

export type StoryListItem = {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly description: string;
  readonly genre: string;
};

export type StoryCharacter = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly background: string;
  readonly initialStats: Record<string, unknown>;
};

export type StoryDetail = StoryListItem & {
  readonly storyVersionId: string;
  readonly storyVersionNumber: number;
  readonly characters: StoryCharacter[];
};

export type AuthorStoryCharacter = {
  readonly id: string;
  readonly type: "playable" | "npc";
  readonly name: string;
  readonly description: string;
  readonly personality: string;
  readonly background: string;
  readonly goals: readonly unknown[];
  readonly secrets: Record<string, unknown>;
  readonly initialStats: Record<string, unknown>;
  readonly initialState: Record<string, unknown>;
  readonly initialLocation: string | null;
  readonly metadata: Record<string, unknown>;
};

export type AuthorStoryFaction = {
  readonly id: string;
  readonly factionKey: string;
  readonly name: string;
  readonly description: string;
  readonly initialStatus: string;
  readonly initialInfluence: number;
  readonly resources: Record<string, unknown>;
  readonly goals: readonly unknown[];
  readonly state: Record<string, unknown>;
};

export type AuthorStorySummary = StoryListItem & {
  readonly status: string;
  readonly currentPublishedVersionId: string | null;
  readonly updatedAt: string;
};

export type AuthorStoryVersion = {
  readonly id: string;
  readonly versionNumber: number;
  readonly status: string;
  readonly createdAt: string;
  readonly publishedAt: string;
};

export type AuthorStoryDetail = AuthorStorySummary & {
  readonly currentPublishedVersionNumber: number | null;
  readonly worldPrompt: string;
  readonly openingPrompt: string;
  readonly settings: Record<string, unknown>;
  readonly characters: readonly AuthorStoryCharacter[];
  readonly factions: readonly AuthorStoryFaction[];
  readonly versions: readonly AuthorStoryVersion[];
};

export type AuthorStoryListResponse = {
  readonly stories: readonly AuthorStorySummary[];
};

export type PublishValidationIssue = {
  readonly code?: string;
  readonly field: string;
  readonly message: string;
};

export type PublishValidationResponse = {
  readonly valid: boolean;
  readonly issues: readonly PublishValidationIssue[];
};

export type SessionListItem = {
  readonly id: string;
  readonly story: StoryListItem;
  readonly selectedCharacter: StoryCharacter | null;
  readonly status: string;
  readonly storyVersionNumber: number | null;
  readonly turnCount: number;
  readonly lastPlayedAt: string;
  readonly createdAt: string;
};

export type GameState = {
  readonly id: string;
  readonly version: number;
  readonly location: string;
  readonly worldTime: string | null;
  readonly playerStats: Record<string, unknown>;
  readonly flags: Record<string, unknown>;
  readonly stateData: Record<string, unknown>;
  readonly updatedAt: string;
};

export type GameMessage = {
  readonly id: string;
  readonly role: string;
  readonly content: string;
  readonly turnNumber: number;
  readonly createdAt: string;
};

export type WorldEvent = {
  readonly id: string;
  readonly eventType: string;
  readonly title: string;
  readonly description: string;
  readonly importance: number;
  readonly payload: Record<string, unknown>;
  readonly turnNumber: number;
  readonly createdAt: string;
};

export type ConsequenceSummary = {
  readonly type: "quest" | "inventory" | "relationship" | "world" | "state";
  readonly title: string;
  readonly description: string;
};

export type Faction = {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly status: string;
  readonly influence: number;
  readonly resources: Record<string, unknown>;
  readonly goals: readonly unknown[];
};

export type FactionListResponse = {
  readonly factions: Faction[];
};

export type SessionDetail = SessionListItem & {
  readonly currentState: GameState | null;
  readonly recentMessages: GameMessage[];
};

export type GameplayTurnResponse = {
  readonly turnNumber: number;
  readonly playerMessage: GameMessage;
  readonly resultMessage: GameMessage;
  readonly state: GameState;
  readonly events: WorldEvent[];
  readonly consequences?: readonly ConsequenceSummary[];
};

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly errorCode?: string,
    readonly issues?: readonly PublishValidationIssue[]
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: buildRequestHeaders(init)
  });

  if (!response.ok) {
    throw await createApiRequestError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function authRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: buildRequestHeaders(init)
  });

  if (!response.ok) {
    throw await createApiRequestError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function buildRequestHeaders(init: RequestInit): Headers {
  const headers = new Headers(init.headers);

  if (
    init.body !== undefined &&
    init.body !== null &&
    !headers.has("content-type")
  ) {
    headers.set("content-type", "application/json");
  }

  return headers;
}

async function createApiRequestError(
  response: Response
): Promise<ApiRequestError> {
  const body = await parseErrorBody(response);
  const message =
    typeof body.message === "string" && body.message.trim()
      ? body.message
      : response.status >= 500
        ? "Unexpected server error."
        : "Request failed.";

  return new ApiRequestError(
    message,
    response.status,
    typeof body.error === "string" ? body.error : undefined,
    parseValidationIssues(body.issues)
  );
}

async function parseErrorBody(
  response: Response
): Promise<{
  readonly error?: unknown;
  readonly message?: unknown;
  readonly issues?: unknown;
}> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const parsed = (await response.json().catch(() => ({}))) as unknown;
    return parsed && typeof parsed === "object" ? parsed : {};
  }

  const text = await response.text().catch(() => "");
  return text.trim() ? { message: text } : {};
}

function parseValidationIssues(
  value: unknown
): readonly PublishValidationIssue[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const issues = value.flatMap((issue) => {
    if (!issue || typeof issue !== "object") {
      return [];
    }
    const record = issue as Record<string, unknown>;
    if (typeof record.field !== "string" || typeof record.message !== "string") {
      return [];
    }

    return [
      {
        ...(typeof record.code === "string" ? { code: record.code } : {}),
        field: record.field,
        message: record.message
      }
    ];
  });

  return issues.length > 0 ? issues : undefined;
}
