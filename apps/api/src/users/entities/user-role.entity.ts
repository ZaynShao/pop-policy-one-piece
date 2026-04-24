import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserRoleCode } from '@pop/shared-types';
import { UserEntity } from './user.entity';

/**
 * 用户 ↔ 角色 分配(PRD §4.2.2)
 *
 * MVP 严格单角色:unique(user_id) 在 DB 层 enforce(与 PRD §4.2.2 一致)。
 * 结构允许未来 N:M(只需拆掉 unique constraint + 迁移业务层判断)。
 */
@Entity('user_roles')
@Index(['userId'], { unique: true })
@Index(['roleCode'])
export class UserRoleEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;

  @Column({
    type: 'enum',
    enum: UserRoleCode,
    enumName: 'role_code',
    name: 'role_code',
  })
  roleCode!: UserRoleCode;

  /** 分配人(PRD §4.2.2,通常 sys_admin) */
  @Column({ type: 'uuid', name: 'assigned_by' })
  assignedBy!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'assigned_by' })
  assigner?: UserEntity;

  @CreateDateColumn({ name: 'assigned_at', type: 'timestamptz' })
  assignedAt!: Date;
}
