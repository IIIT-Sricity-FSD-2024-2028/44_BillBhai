import { Request } from 'express';
import { BadRequestError, ConflictError, ForbiddenError } from '../../errors/http-error';
import { handle, param, query } from '../../utils/http';
import { planOf } from '../../utils/plans';
import { actorId, actorName, assertInScope, isCrossCompany, listScope, writeScope } from '../../utils/scope';
import { companiesService, CompaniesService } from '../companies/companies.service';
import { usersService, UsersService } from './users.service';
import { ChangePasswordDto, CreateUserDto, UpdateUserDto } from './users.schema';

/**
 * Users Module Controller
 *
 * Rules a store admin cannot get around:
 *   - only their own business's staff are visible or editable;
 *   - super user accounts are invisible to them and cannot be created,
 *     edited, promoted to or deleted by them;
 *   - they cannot remove, suspend or demote themselves, or the last active
 *     admin of the business;
 *   - the plan's staff limit is enforced here, not only on the screen.
 */
export class UsersController {
  constructor(
    private readonly service: UsersService = usersService,
    private readonly companies: CompaniesService = companiesService,
  ) {}

  private owned(req: Request) {
    const user = this.service.findOne(param(req, 'id'));
    assertInScope(req, user.companyId, `User ${user.id}`);
    if (user.role === 'superuser' && !isCrossCompany(req)) {
      throw new ForbiddenError('Only the platform super user can change a super user account');
    }
    return user;
  }

  private assertRoleAllowed(req: Request, role: string | undefined): void {
    if (role === 'superuser' && req.auth?.role !== 'superuser' && !isCrossCompany(req)) {
      throw new ForbiddenError('Only the platform super user can create or promote a super user');
    }
  }

  private assertNotLastAdmin(companyId: string, userId: string): void {
    const admins = this.service
      .findAll(companyId, 'admin')
      .filter((u) => u.status === 'Active' && u.id !== userId);
    if (!admins.length) {
      throw new ConflictError('This is the only active admin of the business. Add another admin first.');
    }
  }

  public findAll = handle((req) => {
    const companyId = listScope(req, query(req, 'companyId'));
    const rows = this.service.findAll(companyId, query(req, 'role'));
    return isCrossCompany(req) ? rows : rows.filter((u) => u.role !== 'superuser');
  });

  public findOne = handle((req) => this.owned(req));

  public me = handle((req) => this.service.findOne(actorId(req)));

  public create = handle(async (req) => {
    const body = req.body as CreateUserDto;
    const companyId = writeScope(req, body.companyId);
    this.assertRoleAllowed(req, body.role);
    if (body.role !== 'superuser' && body.role !== 'customer') {
      let company;
      try {
        company = this.companies.findOne(companyId);
      } catch {
        throw new BadRequestError(`Business ${companyId} does not exist`);
      }
      const plan = planOf(company);
      if (this.service.staffCount(companyId) >= plan.limits.maxUsers) {
        throw new ForbiddenError(
          `The ${plan.name} allows ${plan.limits.maxUsers} staff accounts. Upgrade the plan to add more.`,
        );
      }
    }
    return this.service.create({ ...body, companyId }, actorName(req));
  }, 201);

  public update = handle(async (req) => {
    const user = this.owned(req);
    const body = req.body as UpdateUserDto;
    this.assertRoleAllowed(req, body.role);
    const self = user.id === actorId(req);
    if (self && body.role && body.role !== user.role) throw new ForbiddenError('You cannot change your own role');
    if (self && body.status && body.status !== 'Active') throw new ForbiddenError('You cannot suspend yourself');
    const losesAdmin =
      user.role === 'admin' && ((body.role && body.role !== 'admin') || (body.status && body.status !== 'Active'));
    if (losesAdmin) this.assertNotLastAdmin(user.companyId, user.id);
    const becomesStaff =
      body.role && ['customer', 'superuser'].includes(user.role) && !['customer', 'superuser'].includes(body.role);
    if (becomesStaff) {
      const plan = planOf(this.companies.findOne(user.companyId));
      if (this.service.staffCount(user.companyId) >= plan.limits.maxUsers) {
        throw new ForbiddenError(`The ${plan.name} allows ${plan.limits.maxUsers} staff accounts. Upgrade the plan to add more.`);
      }
    }
    return this.service.update(user.id, body, actorName(req));
  });

  public resetPassword = handle(async (req) => {
    const user = this.owned(req);
    return this.service.resetPassword(user.id, actorName(req));
  });

  public changeOwnPassword = handle(async (req) => {
    const body = req.body as ChangePasswordDto;
    return this.service.changeOwnPassword(actorId(req), body.currentPassword, body.newPassword);
  });

  public remove = handle((req) => {
    const user = this.owned(req);
    if (user.id === actorId(req)) throw new ForbiddenError('You cannot delete your own account');
    if (user.role === 'admin' && user.status === 'Active') this.assertNotLastAdmin(user.companyId, user.id);
    return this.service.remove(user.id, actorName(req));
  });
}

export const usersController = new UsersController();
