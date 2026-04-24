import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability';
import { Injectable } from '@nestjs/common';
import { UserRoleCode, type AuthenticatedUser } from '@pop/shared-types';

/**
 * Action 枚举(对齐 PRD §5.1 CRUD 语义)
 * - manage 是 CASL 的"全能"特殊值,等于 create|read|update|delete
 */
export enum Action {
  Manage = 'manage',
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
}

/**
 * 主体占位:V0.1 阶段先只写 "all"(CASL 默认占位),
 * 真正业务实体(Pin / Visit / Tool 等)跟着后端模块一个个加进来。
 *
 * 扩展方式:
 *   export type Subjects = InferSubjects<typeof Pin | typeof Visit> | 'all';
 */
export type Subjects = 'all' | 'Region' | 'User';

export type AppAbility = MongoAbility<[Action, Subjects]>;

/**
 * MVP 简化规则(占位)—— 跟着业务实体一点点细化,对齐 PRD §5:
 *
 * - sys_admin:manage all(PRD §5.4)
 * - 其他 4 角色:只定 read all 占位;create/update/delete 等 Pin/Visit 落地时加
 *
 * 不试图在 Week 2 就铺完 PRD §5 全部矩阵 —— 避免"未使用的规则"腐烂。
 */
@Injectable()
export class CaslAbilityFactory {
  createForUser(user: AuthenticatedUser): AppAbility {
    const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    if (user.roleCode === UserRoleCode.SysAdmin) {
      can(Action.Manage, 'all');
    } else {
      // 占位:其他角色默认只读基线,业务规则随实体落地(Pin/Visit/Tool...)
      can(Action.Read, 'all');
    }

    return build();
  }
}
