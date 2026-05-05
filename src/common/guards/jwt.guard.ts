import { Injectable, ExecutionContext, UnauthorizedException, createParamDecorator, SetMetadata } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../services/prisma.service';

// ── JWT STRATEGY ──────────────────────────────────────────────
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest:   ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:      process.env.JWT_SECRET ?? 'fallback-secret',
    });
  }

  async validate(payload: { sub: string; username: string; roleType: string; branchId: string | null }) {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null, status: 'ACTIVE' },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    if (!user) throw new UnauthorizedException('User not found or inactive');
    return {
      id:          user.id,
      username:    user.username,
      firstName:   user.firstName,
      lastName:    user.lastName,
      roleType:    user.role.type,
      roleId:      user.roleId,
      branchId:    user.branchId,
      permissions: user.role.permissions.filter(rp => rp.granted).map(rp => rp.permission.key),
    };
  }
}

// ── JWT GUARD ─────────────────────────────────────────────────
export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) { super(); }

  canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;
    return super.canActivate(ctx);
  }

  handleRequest(err: any, user: any) {
    if (err || !user) throw err || new UnauthorizedException('Authentication required');
    return user;
  }
}

// ── PERMISSION GUARD ──────────────────────────────────────────
export const PERMISSION_KEY = 'permission';
export const RequirePermission = (...perms: string[]) => SetMetadata(PERMISSION_KEY, perms);

@Injectable()
export class PermissionGuard {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSION_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required?.length) return true;
    const { user } = ctx.switchToHttp().getRequest();
    if (!user) return false;
    if (user.roleType === 'SUPER_ADMIN') return true;
    return required.some(p => user.permissions.includes(p));
  }
}

// ── DECORATORS ────────────────────────────────────────────────
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});

export const BranchId = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.user?.branchId;
});
