import { and, eq, isNull, or, type SQL } from "drizzle-orm";
import { ValidationError } from "./errors.js";
import type { EntityRef } from "./types.js";
import type { PgColumn } from "drizzle-orm/pg-core";

export function firstOrNull<T>(rows: readonly T[]): T | null {
  return rows[0] ?? null;
}

export function firstOrThrow<T>(rows: readonly T[], error: Error): T {
  const row = firstOrNull(rows);
  if (!row) {
    throw error;
  }

  return row;
}

export function assertPositiveLimit(limit: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new ValidationError("Limit must be an integer between 1 and 500.");
  }
}

export function assertEntityRefShape(ref: EntityRef): void {
  if (ref.type === "player" && ref.id) {
    throw new ValidationError("Player entity references must not include an id.");
  }

  if (ref.type === "npc" && !ref.id) {
    throw new ValidationError("NPC entity references must include an id.");
  }
}

export function normalizeEntityId(ref: EntityRef): string | null {
  assertEntityRefShape(ref);
  return ref.type === "player" ? null : (ref.id ?? null);
}

export function entityRefPredicate(
  typeColumn: PgColumn,
  idColumn: PgColumn,
  ref: EntityRef
): SQL {
  const id = normalizeEntityId(ref);

  return and(
    eq(typeColumn, ref.type),
    id === null ? isNull(idColumn) : eq(idColumn, id)
  ) as SQL;
}

export function relationshipEntityPredicate(
  sourceTypeColumn: PgColumn,
  sourceIdColumn: PgColumn,
  targetTypeColumn: PgColumn,
  targetIdColumn: PgColumn,
  ref: EntityRef
): SQL {
  return or(
    entityRefPredicate(sourceTypeColumn, sourceIdColumn, ref),
    entityRefPredicate(targetTypeColumn, targetIdColumn, ref)
  ) as SQL;
}

export function assertInventoryDelta(delta: number): void {
  if (!Number.isInteger(delta) || delta === 0) {
    throw new ValidationError("Inventory quantity delta must be a non-zero integer.");
  }
}
