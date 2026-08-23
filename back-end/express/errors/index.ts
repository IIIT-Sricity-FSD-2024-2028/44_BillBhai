/**
 * Application Errors Directory
 *
 * This directory is the designated location for custom error classes and error handling utilities.
 * Comprehensive error handling and error classes will be integrated by Phase 3 (P3: Validation + Error Handling).
 */

export interface AppErrorOptions {
  statusCode: number;
  message: string;
  details?: unknown;
}
