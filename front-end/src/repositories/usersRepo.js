import { api } from '../lib/http.js';

export const usersRepo = {
  getMe() {
    return api('/users/me');
  },

  changeOwnPassword(body) {
    // TODO: PUT /users/me/password with { method: 'PUT', body }
    return api('/users/me/password', { method: 'PUT', body });
  },

  getAll(query) {
    return api('/users', { query });
  },

  getById(id) {
    // TODO: GET /users/:id (hint: use encodeURIComponent(String(id)))
    return api(`/users/${encodeURIComponent(String(id))}`);
  },

  create(body) {
    // TODO: POST /users with { method: 'POST', body }
    return api('/users', { method: 'POST', body });
  },

  update(id, body) {
    return api(`/users/${encodeURIComponent(String(id))}`, {
      method: 'PUT',
      body,
    });
  },

  resetPassword(id) {
    // TODO: POST /users/:id/reset-password with { method: 'POST' }
    return api(`/users/${encodeURIComponent(String(id))}/reset-password`, { method: 'POST' });
  },

  remove(id) {
    // TODO: DELETE /users/:id with { method: 'DELETE' }
    return api(`/users/${encodeURIComponent(String(id))}`, { method: 'DELETE' });
  },
};