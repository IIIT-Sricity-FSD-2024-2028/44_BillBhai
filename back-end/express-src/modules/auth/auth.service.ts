'use strict';
const bcrypt = require('bcrypt');

class AuthService {
  [key: string]: any;
  constructor(usersService) {
    this.usersService = usersService;
  }

  async validateCredentials(username, password) {
    const user = this.usersService.findByUsernameInternal(username);
    if (!user) {
      await bcrypt.compare(password, '$2b$12$invalidhashusedfortimingattackprevention0000000');
      const err = new Error('Invalid username or password'); err.status = 401; throw err;
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      const err = new Error('Invalid username or password'); err.status = 401; throw err;
    }
    return { id: user.id, username: user.username, role: user.role, companyId: user.companyId };
  }
}

module.exports = { AuthService };
