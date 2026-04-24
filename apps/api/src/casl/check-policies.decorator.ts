import { SetMetadata } from '@nestjs/common';
import type { AppAbility } from './casl-ability.factory';

export type PolicyHandler =
  | ((ability: AppAbility) => boolean)
  | { handle: (ability: AppAbility) => boolean };

export const CHECK_POLICIES_KEY = 'check_policy';

/**
 * 用法:
 *   ```ts
 *   @CheckPolicies((ability) => ability.can(Action.Update, 'Pin'))
 *   @Patch(':id')
 *   update(...) {}
 *   ```
 */
export const CheckPolicies = (...handlers: PolicyHandler[]) =>
  SetMetadata(CHECK_POLICIES_KEY, handlers);
