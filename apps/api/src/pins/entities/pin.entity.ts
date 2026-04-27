import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { PinStatus, PinPriority } from '@pop/shared-types';
import { UserEntity } from '../../users/entities/user.entity';

/**
 * Pin · 图钉(PRD §3.3 B7 / §4.3.1)
 *
 * MVP β.2:9 业务 + 2 地理 + created_by FK to users + 系统时间戳
 * 状态机(B9):in_progress ⇄ completed / aborted,允许重开
 * 编辑权限:β.2 全 sys_admin;V0.7 接 CASL pmo/lead 真矩阵
 */
@Entity('pins')
@Index(['createdBy'])
@Index(['status'])
@Index(['provinceCode'])
export class PinEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // 业务字段(9)
  @Column({ type: 'varchar', length: 100 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({
    type: 'enum',
    enum: ['in_progress', 'completed', 'aborted'],
    enumName: 'pin_status',
    default: 'in_progress',
  })
  status!: PinStatus;

  @Column({ type: 'text', nullable: true, name: 'aborted_reason' })
  abortedReason!: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'closed_by' })
  closedBy!: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'closed_by' })
  closedByUser?: UserEntity | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'closed_at' })
  closedAt!: Date | null;

  @Column({
    type: 'enum',
    enum: ['high', 'medium', 'low'],
    enumName: 'pin_priority',
    default: 'medium',
  })
  priority!: PinPriority;

  // 地理字段(4)
  @Column({ type: 'varchar', length: 6, name: 'province_code' })
  provinceCode!: string;

  @Column({ type: 'varchar', length: 64, name: 'city_name' })
  cityName!: string;

  @Column({ type: 'double precision' })
  lng!: number;

  @Column({ type: 'double precision' })
  lat!: number;

  // 系统字段
  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  creator?: UserEntity;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
