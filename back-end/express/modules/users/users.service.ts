import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { config } from '../../config/index';
import { seedUsers } from '../../data/seed-data';
import { SafeUser, User } from '../../data/entities';
import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from '../../errors/http-error';
import { registerActorCheck } from '../../middleware/rbac.middleware';
import { bumped, checkVersion, diff, initialStamp } from '../../utils/versioning';
import { activityService, ActivityService } from '../activity/activity.service';
import { CreateUserDto, DeleteUserResult, UpdateUserDto } from './users.schema';

/** Readable temporary password: 4 letters + 4 digits, no look-alike characters. */
export function temporaryPassword(): string {
  const letters = 'abcdefghjkmnpqrstuvwxyz';
  let out = '';
  for (let i = 0; i < 4; i += 1) out += letters[randomInt(letters.length)];
  for (let i = 0; i < 4; i += 1) out += String(randomInt(10));
  return out;
}

/**
 * Users Module Service
 *
 * Staff accounts. Passwords are bcrypt hashes and are never returned. A new
 * account with no password gets a temporary one, returned ONCE in the create
 * (or reset) response so the admin can hand it over; it is not stored anywhere
 * in readable form.
 */
export class UsersService {
  private users: User[];

  constructor(private readonly activity: ActivityService = activityService) {
    this.users = seedUsers.map((user) => ({
      ...user,
      password: bcrypt.hashSync(user.password, config.auth.bcryptRounds),
    }));
  }

  private sanitise(user: User): SafeUser {
    const { password: _password, ...safe } = user;
    return safe;
  }

  private nextId(): string {
    const highest = this.users.reduce((max, u) => Math.max(max, Number(u.id.replace(/\D/g, '')) || 0), 0);
    return `USR-${String(highest + 1).padStart(3, '0')}`;
  }

  public findByUsernameInternal(username: string): User | null {
    const needle = String(username || '').trim().toLowerCase();
    if (!needle) return null;
    return (
      this.users.find(
        (user) =>
          user.username.toLowerCase() === needle ||
          String(user.email || '').trim().toLowerCase() === needle,
      ) ?? null
    );
  }

  public findAll(companyId?: string, role?: string): SafeUser[] {
    return this.users
      .filter((user) => (companyId ? user.companyId === companyId : true))
      .filter((user) => (role ? user.role === role : true))
      .map((user) => this.sanitise(user));
  }

  public findOne(id: string): SafeUser {
    const user = this.users.find((entry) => entry.id === id);
    if (!user) {
      throw new NotFoundError(`User ${id} not found`);
    }
    return this.sanitise(user);
  }

  private assertUnique(username: string, email: string, exceptId?: string): void {
    const u = username.trim().toLowerCase();
    const e = email.trim().toLowerCase();
    const clash = this.users.find(
      (user) =>
        user.id !== exceptId && (user.username.toLowerCase() === u || user.email.toLowerCase() === e),
    );
    if (clash) {
      throw new ConflictError(
        clash.username.toLowerCase() === u ? `Username "${username}" is already taken` : `${email} is already used by another account`,
      );
    }
  }

  public async create(
    dto: CreateUserDto & { companyId: string },
    by = 'system',
  ): Promise<SafeUser & { temporaryPassword?: string }> {
    this.assertUnique(dto.username, dto.email);
    const temp = dto.password ? undefined : temporaryPassword();
    const created: User = {
      id: this.nextId(),
      companyId: dto.companyId,
      name: dto.name.trim(),
      role: dto.role,
      email: dto.email.trim(),
      mobileNo: dto.mobileNo,
      username: dto.username.trim(),
      password: await bcrypt.hash(dto.password || temp!, config.auth.bcryptRounds),
      status: dto.status || 'Active',
      ...initialStamp(by),
    };
    this.users.push(created);
    this.activity.log({
      companyId: created.companyId,
      entity: 'user',
      entityId: created.id,
      action: 'create',
      summary: `${created.name} added as ${created.role}`,
      by,
    });
    const safe = this.sanitise(created);
    return temp ? { ...safe, temporaryPassword: temp } : safe;
  }

  public async update(id: string, dto: UpdateUserDto, by = 'system'): Promise<SafeUser> {
    const index = this.users.findIndex((user) => user.id === id);
    if (index === -1) {
      throw new NotFoundError(`User ${id} not found`);
    }
    const current = this.users[index];
    checkVersion(current, dto.version, `User ${current.name}`);
    if (dto.username || dto.email) {
      this.assertUnique(dto.username ?? current.username, dto.email ?? current.email, id);
    }
    const { version: _v, password, companyId: _c, ...changes } = dto;
    const updates: Partial<User> = { ...changes };
    if (password) {
      updates.password = await bcrypt.hash(password, config.auth.bcryptRounds);
    }
    const updated = bumped({ ...current, ...updates }, by);
    this.users[index] = updated;
    const changed = diff(current, updated, ['name', 'role', 'email', 'mobileNo', 'username', 'status']);
    if (Object.keys(changed).length || password) {
      this.activity.log({
        companyId: current.companyId,
        entity: 'user',
        entityId: id,
        action: 'update',
        summary: `${updated.name}: ${[...Object.keys(changed), ...(password ? ['password'] : [])].join(', ')} changed`,
        changes: changed,
        by,
      });
    }
    return this.sanitise(updated);
  }

  /** Sets a new temporary password and returns it once. */
  public async resetPassword(id: string, by = 'system'): Promise<SafeUser & { temporaryPassword: string }> {
    const temp = temporaryPassword();
    const user = await this.update(id, { password: temp }, by);
    return { ...user, temporaryPassword: temp };
  }

  /** Checks the current password before setting a new one (Profile page). */
  public async changeOwnPassword(id: string, currentPassword: string, newPassword: string): Promise<SafeUser> {
    const user = this.users.find((u) => u.id === id);
    if (!user) throw new NotFoundError(`User ${id} not found`);
    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) throw new BadRequestError('Your current password is not correct');
    if (currentPassword === newPassword) throw new BadRequestError('Choose a password different from the current one');
    return this.update(id, { password: newPassword }, user.username);
  }

  public remove(id: string, by = 'system'): DeleteUserResult {
    const index = this.users.findIndex((user) => user.id === id);
    if (index === -1) {
      throw new NotFoundError(`User ${id} not found`);
    }
    const [removed] = this.users.splice(index, 1);
    this.activity.log({
      companyId: removed.companyId,
      entity: 'user',
      entityId: id,
      action: 'delete',
      summary: `${removed.name} (${removed.role}) removed`,
      by,
    });
    return { message: `User ${id} deleted`, user: this.sanitise(removed) };
  }

  /** Active staff count of a business (customers' self-checkout logins and suspended staff excluded). */
  public staffCount(companyId: string): number {
    return this.users.filter(
      (u) =>
        u.companyId === companyId &&
        u.status === 'Active' &&
        u.role !== 'customer' &&
        u.role !== 'superuser',
    ).length;
  }

  public dump(): { users: User[] } {
    return { users: this.users };
  }

  public load(state: { users?: User[] }): void {
    if (Array.isArray(state.users)) this.users = state.users;
  }
}

export const usersService = new UsersService();

/**
 * A token only works while its account exists and is active, so removing or
 * suspending someone signs them out on their next request.
 */
registerActorCheck((actor) => {
  if (!actor.id) return;
  const user = usersService.dump().users.find((u) => u.id === actor.id);
  if (!user) throw new UnauthorizedError('This account no longer exists. Please sign in again.');
  if (String(user.status || '').toLowerCase() !== 'active') {
    throw new UnauthorizedError('This account is not active. Ask your admin.');
  }
  if (user.role.toLowerCase() !== actor.role) {
    throw new UnauthorizedError('Your role has changed. Please sign in again.');
  }
});
