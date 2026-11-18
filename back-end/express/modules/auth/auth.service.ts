import bcrypt from 'bcryptjs';
import { config } from '../../config/index';
import { UnauthorizedError } from '../../errors/http-error';
import { signAccessToken } from '../../middleware/rbac.middleware';
import { usersService, UsersService } from '../users/users.service';
import { companiesService } from '../companies/companies.service';
import { AuthenticatedUser, LoginDto, LoginResult } from './auth.schema';
import { planKeyOf } from '../../utils/plans';

/**
 * Auth Module Service
 *
 * Verifies credentials against the bcrypt hashes held by UsersService and
 * issues a signed JWT.
 *
 * A dummy comparison runs when the username does not exist so that a wrong
 * username and a wrong password take the same amount of time. Without it the
 * response time leaks which usernames are real.
 */
const DUMMY_HASH = bcrypt.hashSync('timing-attack-mitigation', 10);

export class AuthService {
  constructor(private readonly users: UsersService = usersService) {}

  public async validateCredentials(dto: LoginDto): Promise<AuthenticatedUser> {
    const user = this.users.findByUsernameInternal(dto.username);

    if (!user) {
      await bcrypt.compare(dto.password, DUMMY_HASH);
      throw new UnauthorizedError('Invalid username or password');
    }

    const matches = await bcrypt.compare(dto.password, user.password);
    if (!matches) {
      throw new UnauthorizedError('Invalid username or password');
    }

    if (user.status && user.status.toLowerCase() !== 'active') {
      throw new UnauthorizedError('This account is not active. Ask your admin.');
    }

    if (user.role !== 'superuser') {
      let company;
      try {
        company = companiesService.findOne(user.companyId);
      } catch {
        throw new UnauthorizedError('Your business is no longer registered');
      }
      if (company.status && company.status !== 'Active') {
        throw new UnauthorizedError(`${company.name} is ${company.status.toLowerCase()}. Contact BillBhai support.`);
      }
    }

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      email: user.email,
      mobileNo: user.mobileNo,
      companyId: user.companyId,
    };
  }

  public async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.validateCredentials(dto);

    const accessToken = signAccessToken({
      sub: user.id,
      username: user.username,
      role: user.role,
      companyId: user.companyId,
    });

    let businessName = '';
    let plan = '';
    try {
      const company = companiesService.findOne(user.companyId);
      businessName = company.name;
      plan = planKeyOf(company);
    } catch {
      businessName = '';
    }

    return {
      ...user,
      businessName,
      plan,
      accessToken,
      tokenType: 'Bearer',
      expiresIn: config.auth.jwtExpiresIn,
    };
  }
}

export const authService = new AuthService();
