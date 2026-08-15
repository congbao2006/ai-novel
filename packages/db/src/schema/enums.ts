import { pgEnum } from "drizzle-orm/pg-core";
import {
  aiUsagePurposes,
  aiUsageStatuses,
  entityTypes,
  messageRoles,
  questStatuses,
  sessionStatuses,
  storyStatuses
} from "@ai-novel/domain";

export const storyStatusEnum = pgEnum("story_status", storyStatuses);
export const sessionStatusEnum = pgEnum("session_status", sessionStatuses);
export const messageRoleEnum = pgEnum("message_role", messageRoles);
export const questStatusEnum = pgEnum("quest_status", questStatuses);
export const entityTypeEnum = pgEnum("entity_type", entityTypes);
export const aiUsagePurposeEnum = pgEnum("ai_usage_purpose", aiUsagePurposes);
export const aiUsageStatusEnum = pgEnum("ai_usage_status", aiUsageStatuses);
