'use strict';
const bcrypt = require('bcrypt');
const { seedUsers } = require('../../seed/seed-data');

const VALID_ROLES = ['superuser','admin','cashier','returnhandler','inventorymanager','deliveryops','customer'];

class UsersService {
  [key: string]: any;
  constructor() {
    this.users = seedUsers.map((u) => ({ ...u }));
    this.counter = this.users.length + 1;
  }

  _sanitize(user) {
    const safe = { ...user };
    delete safe.password;
    return safe;
  }

  // Internal — returns raw user including password hash. Only for AuthService.
  findByUsernameInternal(username) {
    const norm = String(username || '').trim().toLowerCase();
    if (!norm) return null;
    return this.users.find(
      (u) => u.username.toLowerCase() === norm || String(u.email || '').trim().toLowerCase() === norm
    ) ?? null;
  }

  findAll(companyId) {
    const list = companyId ? this.users.filter((u) => u.companyId === companyId) : this.users;
    return list.map((u) => this._sanitize(u));
  }

  findOne(id) {
    const user = this.users.find((u) => u.id === id);
    if (!user) { const err = new Error(`User ${id} not found`); err.status = 404; throw err; }
    return this._sanitize(user);
  }

  async create(dto) {
    if (!dto.username || !dto.email || !dto.password || !dto.name || !dto.role || !dto.companyId || !dto.mobileNo) {
      const err = new Error('username, email, password, name, role, companyId and mobileNo are required'); err.status = 400; throw err;
    }
    if (!VALID_ROLES.includes(dto.role)) {
      const err = new Error(`role must be one of: ${VALID_ROLES.join(', ')}`); err.status = 400; throw err;
    }
    const exists = this.users.find((u) => u.username === dto.username || u.email === dto.email);
    if (exists) { const err = new Error('Username or email already in use'); err.status = 409; throw err; }
    const hashed = await bcrypt.hash(dto.password, 12);
    const newUser = {
      id: `USR-${String(this.counter++).padStart(3, '0')}`,
      companyId: dto.companyId,
      name: dto.name,
      role: dto.role,
      email: dto.email,
      mobileNo: dto.mobileNo,
      username: dto.username,
      password: hashed,
      status: 'Active',
    };
    this.users.push(newUser);
    return this._sanitize(newUser);
  }

  async update(id, dto) {
    const idx = this.users.findIndex((u) => u.id === id);
    if (idx === -1) { const err = new Error(`User ${id} not found`); err.status = 404; throw err; }
    const updates = { ...dto };
    if (dto.role && !VALID_ROLES.includes(dto.role)) {
      const err = new Error(`role must be one of: ${VALID_ROLES.join(', ')}`); err.status = 400; throw err;
    }
    if (dto.password) { updates.password = await bcrypt.hash(dto.password, 12); }
    this.users[idx] = { ...this.users[idx], ...updates };
    return this._sanitize(this.users[idx]);
  }

  remove(id) {
    const idx = this.users.findIndex((u) => u.id === id);
    if (idx === -1) { const err = new Error(`User ${id} not found`); err.status = 404; throw err; }
    const [removed] = this.users.splice(idx, 1);
    return { message: `User ${id} deleted`, user: this._sanitize(removed) };
  }
}

module.exports = { UsersService };
