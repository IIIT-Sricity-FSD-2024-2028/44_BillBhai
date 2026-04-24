import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { seedUsers } from '../../common/seed/seed-data';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

/**
 * UsersService: Manages platform staff and administrators.
 * It handles password security by ensuring passwords are never returned in API responses.
 */
@Injectable()
export class UsersService {
  // In-memory user store
  private users = seedUsers.map(u => ({ ...u }));
  private counter = this.users.length + 1;

  findAll(companyId?: string) {
    const list = companyId ? this.users.filter(u => u.companyId === companyId) : this.users;
    return list.map(({ password, ...u }) => u);
  }

  findOne(id: string) {
    const user = this.users.find(u => u.id === id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    const { password, ...safe } = user;
    return safe;
  }

  findByUsername(username: string) {
    return this.users.find(u => u.username === username.toLowerCase()) ?? null;
  }

  create(dto: CreateUserDto) {
    const exists = this.users.find(u => u.username === dto.username || u.email === dto.email);
    if (exists) throw new ConflictException('Username or email already in use');
    const newUser = {
      id: `USR-${String(this.counter++).padStart(3, '0')}`,
      ...dto,
      status: 'Active',
    };
    this.users.push(newUser);
    const { password, ...safe } = newUser;
    return safe;
  }

  update(id: string, dto: UpdateUserDto) {
    const idx = this.users.findIndex(u => u.id === id);
    if (idx === -1) throw new NotFoundException(`User ${id} not found`);
    this.users[idx] = { ...this.users[idx], ...dto };
    const { password, ...safe } = this.users[idx];
    return safe;
  }

  remove(id: string) {
    const idx = this.users.findIndex(u => u.id === id);
    if (idx === -1) throw new NotFoundException(`User ${id} not found`);
    const [removed] = this.users.splice(idx, 1);
    const { password, ...safe } = removed;
    return { message: `User ${id} deleted`, user: safe };
  }
}
