import { Request } from 'express';
import { ConflictError, ForbiddenError } from '../../errors/http-error';
import { handle, param } from '../../utils/http';
import { actorName, assertInScope, isCrossCompany } from '../../utils/scope';
import { authService, AuthService } from '../auth/auth.service';
import { usersService, UsersService } from '../users/users.service';
import { companiesService, CompaniesService } from './companies.service';
import { CreateCompanyDto, RegisterCompanyDto, UpdateCompanyDto } from './companies.schema';

/** Fields a store admin may edit on their own business. */
const ADMIN_EDITABLE = ['name', 'email', 'phone', 'address', 'gstNo', 'owner', 'adminName', 'type', 'version'];

/**
 * Companies Module Controller
 *
 * The super user manages every business. A store admin can read and edit the
 * basic details of their own business and change its plan.
 */
export class CompaniesController {
  constructor(
    private readonly service: CompaniesService = companiesService,
    private readonly users: UsersService = usersService,
    private readonly auth: AuthService = authService,
  ) {}

  private owned(req: Request) {
    const company = this.service.findOne(param(req, 'id'));
    assertInScope(req, company.id, `Company ${company.id}`);
    return company;
  }

  public findAll = handle(() => this.service.findAll());

  public findOne = handle((req) => this.owned(req));

  /** What every staff screen may know about its own business (for bills). */
  public myProfile = handle((req) => {
    const id = String(req.auth?.companyId || '');
    const c = this.service.findOne(id);
    return { id: c.id, name: c.name, gstNo: c.gstNo, address: c.address, phone: c.phone, email: c.email, plan: c.plan, status: c.status };
  });

  public create = handle((req) => this.service.create(req.body as CreateCompanyDto, actorName(req)), 201);

  public update = handle((req) => {
    const company = this.owned(req);
    const body = req.body as UpdateCompanyDto;
    if (!isCrossCompany(req)) {
      const blocked = Object.keys(body).filter((k) => !ADMIN_EDITABLE.includes(k));
      if (blocked.length) {
        throw new ForbiddenError(`Only the platform super user can change: ${blocked.join(', ')}`);
      }
    }
    return this.service.update(company.id, body, actorName(req));
  });

  public changePlan = handle((req) => {
    const company = this.owned(req);
    return this.service.changePlan(company.id, (req.body as { plan: 'starter' | 'pro' | 'enterprise' }).plan, actorName(req));
  });

  public cancelSubscription = handle((req) => {
    const company = this.owned(req);
    return this.service.cancelSubscription(company.id, actorName(req));
  });

  /**
   * Public sign-up. Checks everything first, then creates the business and
   * its admin together and signs the admin in. If the admin account cannot be
   * created, the business is removed again so a retry starts clean.
   */
  public register = handle(async (req) => {
    const body = req.body as RegisterCompanyDto;
    this.service.assertAvailable(body.company.name, body.company.email);
    if (this.users.findByUsernameInternal(body.admin.username) || this.users.findByUsernameInternal(body.admin.email)) {
      throw new ConflictError(`Username "${body.admin.username}" or email ${body.admin.email} is already taken. Pick another.`);
    }
    const company = this.service.create(
      { ...body.company, plan: body.plan, adminName: body.admin.name, owner: body.company.owner || body.admin.name },
      body.admin.username,
    );
    try {
      await this.users.create(
        {
          companyId: company.id,
          name: body.admin.name,
          role: 'admin',
          email: body.admin.email,
          mobileNo: body.admin.mobileNo,
          username: body.admin.username,
          password: body.admin.password,
          status: 'Active',
        },
        body.admin.username,
      );
    } catch (error) {
      this.service.remove(company.id);
      throw error;
    }
    const session = await this.auth.login({ username: body.admin.username, password: body.admin.password });
    return { company, session };
  }, 201);

  public remove = handle((req) => {
    const company = this.owned(req);
    // Staff of a removed business can no longer sign in.
    this.users.findAll(company.id).forEach((u) => {
      if (u.status === 'Active') void this.users.update(u.id, { status: 'Suspended' }, actorName(req));
    });
    return this.service.remove(company.id);
  });
}

export const companiesController = new CompaniesController();
