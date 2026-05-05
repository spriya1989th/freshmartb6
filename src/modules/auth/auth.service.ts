import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/services/prisma.service';
import { AuditService } from '../../common/services/audit.service';

export interface JwtPayload {
  sub: string; username: string; roleType: string; branchId: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private audit: AuditService,
  ) {}

  async login(username: string, password: string, ipAddress?: string) {
    const user = await this.prisma.user.findFirst({
      where: { username, deletedAt: null },
      include: { role: { include: { permissions: { include: { permission: true } } } }, branch: true },
    });
    if (!user || user.status !== 'ACTIVE') throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.audit.log({ userId: user.id, action: 'LOGIN', module: 'auth', ipAddress, branchId: user.branchId ?? undefined });

    const permissions = user.role.permissions.filter(rp => rp.granted).map(rp => rp.permission.key);
    const payload: JwtPayload = { sub: user.id, username: user.username, roleType: user.role.type, branchId: user.branchId };
    return {
      access_token: this.jwt.sign(payload),
      user: { id: user.id, username: user.username, firstName: user.firstName, lastName: user.lastName, role: user.role.type, branchId: user.branchId, branch: user.branch, permissions },
    };
  }

  async changePassword(userId: string, currentPwd: string, newPwd: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = await bcrypt.compare(currentPwd, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');
    const hash = await bcrypt.hash(newPwd, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
    await this.audit.log({ userId, action: 'UPDATE', module: 'auth', entityType: 'User', notes: 'Password changed' });
  }

  async validateJwt(payload: JwtPayload) {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null, status: 'ACTIVE' },
      include: { role: true },
    });
    return user;
  }

  async createUser(data: { username: string; email: string; password: string; firstName: string; lastName: string; roleId: string; branchId?: string; }, createdById: string) {
    const existing = await this.prisma.user.findFirst({ where: { OR: [{ username: data.username }, { email: data.email }] } });
    if (existing) throw new ConflictException('Username or email already exists');
    const hash = await bcrypt.hash(data.password, 12);
    const user = await this.prisma.user.create({ data: { ...data, passwordHash: hash, password: undefined } as any });
    await this.audit.log({ userId: createdById, action: 'CREATE', module: 'users', entityId: user.id, entityType: 'User', newValues: { username: data.username, email: data.email } });
    return user;
  }
}
