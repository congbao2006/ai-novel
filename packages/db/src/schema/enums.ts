import { pgEnum } from "drizzle-orm/pg-core";
import {
  aiUsagePurposes,
  aiUsageStatuses,
  entityTypes,
  factionStatuses,
  memoryTypes,
  messageRoles,
  questStatuses,
  sessionStatuses,
  storyCharacterTypes,
  storyVersionStatuses,
  storyStatuses
} from "@ai-novel/domain";

export const storyStatusEnum = pgEnum("story_status", storyStatuses);
export const storyCharacterTypeEnum = pgEnum(
  "story_character_type",
  storyCharacterTypes
);
export const storyVersionStatusEnum = pgEnum(
  "story_version_status",
  storyVersionStatuses
);
export const sessionStatusEnum = pgEnum("session_status", sessionStatuses);
export const messageRoleEnum = pgEnum("message_role", messageRoles);
export const questStatusEnum = pgEnum("quest_status", questStatuses);
export const entityTypeEnum = pgEnum("entity_type", entityTypes);
export const factionStatusEnum = pgEnum("faction_status", factionStatuses);
export const aiUsagePurposeEnum = pgEnum("ai_usage_purpose", aiUsagePurposes);
export const aiUsageStatusEnum = pgEnum("ai_usage_status", aiUsageStatuses);
export const memoryTypeEnum = pgEnum("memory_type", memoryTypes);
