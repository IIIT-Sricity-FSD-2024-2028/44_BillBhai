/**
 * Shared Utilities Directory
 *
 * This directory contains cross-cutting utility functions and helpers used across modules.
 * Only general-purpose, module-agnostic helpers belong here.
 */

/**
 * Safely parses a string to a positive integer with a default fallback.
 */
export function parseInteger(value: unknown, defaultValue: number): number {
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return defaultValue;
}
