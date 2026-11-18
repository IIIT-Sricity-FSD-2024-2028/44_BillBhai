import { ActivityEntry } from '../../data/entities';
import { nowIso } from '../../utils/versioning';

/**
 * Activity log: who changed what, and when.
 *
 * Every module writes here when a person creates, changes, cancels or deletes
 * something. The Orders, Inventory, Returns and Delivery pages read it to show
 * a record's history, and admins can read the whole store's log.
 */
export class ActivityService {
  private entries: ActivityEntry[] = [];
  private counter = 1;

  public log(entry: Omit<ActivityEntry, 'id' | 'at'> & { at?: string }): ActivityEntry {
    const created: ActivityEntry = {
      ...entry,
      id: `ACT-${String(this.counter++).padStart(6, '0')}`,
      at: entry.at ?? nowIso(),
    };
    this.entries.unshift(created);
    if (this.entries.length > 5000) this.entries.length = 5000;
    return created;
  }

  public find(filter: {
    companyId?: string;
    entity?: string;
    entityId?: string;
    limit?: number;
  }): ActivityEntry[] {
    const limit = Math.min(500, Math.max(1, Number(filter.limit) || 100));
    return this.entries
      .filter((e) => (filter.companyId ? e.companyId === filter.companyId : true))
      .filter((e) => (filter.entity ? e.entity === filter.entity : true))
      .filter((e) => (filter.entityId ? e.entityId === filter.entityId : true))
      .slice(0, limit)
      .map((e) => ({ ...e }));
  }

  public dump(): { entries: ActivityEntry[]; counter: number } {
    return { entries: this.entries, counter: this.counter };
  }

  public load(state: { entries?: ActivityEntry[]; counter?: number }): void {
    this.entries = Array.isArray(state.entries) ? state.entries : [];
    this.counter = Number(state.counter) || this.entries.length + 1;
  }
}

export const activityService = new ActivityService();
