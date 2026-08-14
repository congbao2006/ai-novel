"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  authRequest,
  type SessionDetail,
  type StoryCharacter
} from "../../../lib/api";

type StartSessionFormProps = {
  readonly storyId: string;
  readonly storySlug: string;
  readonly characters: StoryCharacter[];
};

export function StartSessionForm({
  storyId,
  storySlug,
  characters
}: StartSessionFormProps) {
  const router = useRouter();
  const [selectedCharacterId, setSelectedCharacterId] = useState(
    characters[0]?.id ?? ""
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function startSession() {
    setError(null);
    setLoading(true);

    try {
      const result = await authRequest<{ session: SessionDetail }>("/sessions", {
        method: "POST",
        body: JSON.stringify({
          storyId,
          characterId: selectedCharacterId
        })
      });

      router.push(`/play/${result.session.id}`);
      router.refresh();
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Không thể tạo session.";

      if (message.toLowerCase().includes("unauthenticated")) {
        router.push(`/login?next=/stories/${storySlug}`);
        return;
      }

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold">Chọn nhân vật</h2>
      <div className="choice-list mt-4">
        {characters.map((character) => (
          <label key={character.id}>
            <span className="font-medium">
              <input
                checked={selectedCharacterId === character.id}
                name="character"
                onChange={() => setSelectedCharacterId(character.id)}
                type="radio"
              />
              {character.name}
            </span>
            <span className="text-sm leading-6 text-[var(--muted)]">
              {character.description}
            </span>
            <span className="text-sm leading-6 text-[var(--muted)]">
              {character.background}
            </span>
          </label>
        ))}
      </div>

      {error ? <p className="auth-error mt-4">{error}</p> : null}
      <button
        className="mt-5 auth-link"
        disabled={loading || !selectedCharacterId}
        onClick={startSession}
        type="button"
      >
        {loading ? "Đang tạo..." : "Bắt đầu session"}
      </button>
    </div>
  );
}
