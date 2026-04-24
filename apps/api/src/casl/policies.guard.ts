import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '@pop/shared-types';
import { CaslAbilityFactory } from './casl-ability.factory';
import {
  CHECK_POLICIES_KEY,
  type PolicyHandler,
} from './check-policies.decorator';

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private abilityFactory: CaslAbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const handlers =
      this.reflector.get<PolicyHandler[]>(
        CHECK_POLICIES_KEY,
        context.getHandler(),
      ) ?? [];
    if (handlers.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!req.user) throw new ForbiddenException('未认证');

    const ability = this.abilityFactory.createForUser(req.user);
    const ok = handlers.every((h) =>
      typeof h === 'function' ? h(ability) : h.handle(ability),
    );
    if (!ok) throw new ForbiddenException('权限不足');
    return true;
  }
}
