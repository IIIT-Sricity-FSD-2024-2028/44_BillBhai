/**
 * Normalizes any thrown repository/network error into the consistent thunk rejection shape.
 *
 * @param {unknown} error
 * @param {string} [fallback='Request failed']
 * @returns {{ message: string, status: number }}
 */
export function toThunkError(error, fallback = 'Request failed') {
  if (typeof error === 'string') {
    return { message: error || fallback, status: 0 };
  }
  return {
    message: String(error?.message || fallback),
    status: Number(error?.status ?? 0),
  };
}

/**
 * Extracts a displayable error message from a rejected thunk error (.unwrap()) or Error.
 *
 * @param {unknown} err
 * @param {string} [fallback='Something went wrong.']
 * @returns {string}
 */
export function extractErrorMessage(err, fallback = 'Something went wrong.') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  return String(err.message || fallback);
}
