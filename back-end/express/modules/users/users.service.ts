import bcrypt from 'bcryptjs';
import { config } from '../../config/index';
import { seedUsers } from '../../data/seed-data';
import { SafeUser, User } from '../../data/entities';
import { ConflictError, NotFoundError } from '../../errors/http-error';
import { CreateUserDto, DeleteUserResult, UpdateUserDto } from './users.schema';

/**
 * Users Module Service
 *
 * Owns the staff account store. Framework agnostic: no express imports, no
 * request or response objects, no HTTP status codes.
 *
 * Security note: the seeded demo passwords are hashed with bcrypt at startup,
 * so the array held in memory never contains a plain text credential, and
 * `sanitise()` strips the hash from everything that leaves this service.
 */
export class UsersService {
  private users: User[];
  private counter: number;

  constructor() {
    this.users = seedUsers.map((user) => ({
      ...user,
      password: bcrypt.hashSync(user.password, config.auth.bcryptRounds),
    }));
    this.counter = this.users.length + 1;
  }

  private sanitise(user: User): SafeUser {
    const { password: _password, ...safe } = user;
    return safe;
  }

  /**
   * Returns the raw record including the password hash.
   * INTERNAL ONLY - the auth service is the sole legitimate caller.
   */
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

  public async create(dto: CreateUserDto): Promise<SafeUser> {
    const clash = this.users.find(
      (user) => user.username === dto.username || user.email === dto.email,
    );
    if (clash) {
      throw new ConflictError('Username or email is already in use');
    }

    const created: User = {
      id: `USR-${String(this.counter++).padStart(3, '0')}`,
      companyId: dto.companyId,
      name: dto.name,
      role: dto.role,
      email: dto.email,
      mobileNo: dto.mobileNo,
      username: dto.username,
      password: await bcrypt.hash(dto.password, config.auth.bcryptRounds),
      status: dto.status || 'Active',
    };

    this.users.push(created);
    return this.sanitise(created);
  }

  public async update(id: string, dto: UpdateUserDto): Promise<SafeUser> {
    const index = this.users.findIndex((user) => user.id === id);
    if (index === -1) {
      throw new NotFoundError(`User ${id} not found`);
    }

    const updates: Partial<User> = { ...dto };
    if (dto.password) {
      updates.password = await bcrypt.hash(dto.password, config.auth.bcryptRounds);
    }

    this.users[index] = { ...this.users[index], ...updates };
    return this.sanitise(this.users[index]);
  }

  public remove(id: string): DeleteUserResult {
    const index = this.users.findIndex((user) => user.id === id);
    if (index === -1) {
      throw new NotFoundError(`User ${id} not found`);
    }

    const [removed] = this.users.splice(index, 1);
    return { message: `User ${id} deleted`, user: this.sanitise(removed) };
  }
}

export const usersService = new UsersService();
