import { api } from '../lib/http.js';

export const authRepo = {
  /**
   * POST /auth/login
   * anonymous: true because the user does not have a token yet.
   */
  login({ username, password }) {
    return api('/auth/login', {
      method: 'POST',
      anonymous: true,
      body: { username, password },
    });
  },

  /**
   * GET /auth/profile
   */
  getProfile() {
    return api('/auth/profile');
  },
};