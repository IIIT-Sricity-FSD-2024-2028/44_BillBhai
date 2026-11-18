import { ConflictError } from '../errors/http-error';
import { Versioned } from '../data/entities';

/**
 * Record versioning.
 *
 * Every change bumps `version` and stamps who made it and when. A client that
 * sends the version it loaded gets a 409 if someone changed the record in the
 * meantime, instead of silently overwriting their work.
 */

export function nowIso(): string {
  return new Date().toISOString();
}

export function initialStamp(by: string): Versioned {
  const at = nowIso();
  return { version: 1, createdAt: at, updatedAt: at, updatedBy: by };
}

export function checkVersion(current: Partial<Versioned>, expected: unknown, label: string): void {
  if (expected === undefined || expected === null || expected === '') return;
  const want = Number(expected);
  const have = Number(current.version ?? 1);
  if (Number.isFinite(want) && want !== have) {
    throw new ConflictError(
      `${label} was changed by ${current.updatedBy || 'someone else'} since you opened it. Reload to see the latest version.`,
      { currentVersion: have },
    );
  }
}

export function bumped<T extends Partial<Versioned>>(record: T, by: string): T {
  return {
    ...record,
    version: Number(record.version ?? 1) + 1,
    updatedAt: nowIso(),
    updatedBy: by,
  };
}

/** Field-by-field differences, for the activity log. */
export function diff(
  before: object,
  after: object,
  fields: string[],
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const b = before as Record<string, unknown>;
  const a = after as Record<string, unknown>;
  fields.forEach((field) => {
    const from = b[field];
    const to = a[field];
    if (JSON.stringify(from) !== JSON.stringify(to)) changes[field] = { from, to };
  });
  return changes;
}
