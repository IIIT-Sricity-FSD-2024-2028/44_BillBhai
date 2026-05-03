import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { seedUsers } from '../../common/seed/seed-data';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

/**
 * UsersService: Manages platform staff and administrators.
 * It handles password security by ensuring passwords are never returned in API responses.
 */
@Injectable()
export class UsersService {
  // In-memory user store
  private users = seedUsers.map((u) => ({ ...u }));
  private counter = this.users.length + 1;

  private sanitizeUser<T extends Record<string, unknown>>(user: T) {
    const safe = { ...user };
    delete (safe as { password?: string }).password;
    return safe;
  }

  findAll(companyId?: string) {
    const list = companyId
      ? this.users.filter((u) => u.companyId === companyId)
      : this.users;
    return list.map((u) => this.sanitizeUser(u));
  }

  findOne(id: string) {
    const user = this.users.find((u) => u.id === id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return this.sanitizeUser(user);
  }

  findByUsername(username: string) {
    return (
      this.users.find((u) => u.username === username.toLowerCase()) ?? null
    );
  }

  findByUsernameAndPassword(username: string, password: string) {
    return (
      this.users.find(
        (u) => u.username === username.toLowerCase() && u.password === password,
      ) ?? null
    );
  }

  create(dto: CreateUserDto) {
    const exists = this.users.find(
      (u) => u.username === dto.username || u.email === dto.email,
    );
    if (exists) throw new ConflictException('Username or email already in use');
    const newUser = {
      id: `USR-${String(this.counter++).padStart(3, '0')}`,
      ...dto,
      status: 'Active',
    };
    this.users.push(newUser);
    return this.sanitizeUser(newUser);
  }

  update(id: string, dto: UpdateUserDto) {
    const idx = this.users.findIndex((u) => u.id === id);
    if (idx === -1) throw new NotFoundException(`User ${id} not found`);
    this.users[idx] = { ...this.users[idx], ...dto };
    return this.sanitizeUser(this.users[idx]);
  }

  remove(id: string) {
    const idx = this.users.findIndex((u) => u.id === id);
    if (idx === -1) throw new NotFoundException(`User ${id} not found`);
    const [removed] = this.users.splice(idx, 1);
    return { message: `User ${id} deleted`, user: this.sanitizeUser(removed) };
  }
}
