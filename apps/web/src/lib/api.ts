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
  readonly characters: StoryCharacter[];
};

export type SessionListItem = {
  readonly id: string;
  readonly story: StoryListItem;
  readonly selectedCharacter: StoryCharacter | null;
  readonly status: string;
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
};

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers
    }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      typeof body.message === "string" ? body.message : "Request failed."
    );
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
    headers: {
      "content-type": "application/json",
      ...init.headers
    }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      typeof body.message === "string" ? body.message : "Request failed."
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
