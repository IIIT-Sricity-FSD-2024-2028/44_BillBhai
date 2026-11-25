import { api } from '../../shared/lib/http.js';

export const activityRepo = {
  getAll(query) {
    // TODO: call api('/activity', { query })
    return api('/activity', { query });
  },
};