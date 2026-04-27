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
import type { VisitStatusColor, VisitStatus } from '@pop/shared-types';
import { UserEntity } from '../../users/entities/user.entity';
import { PinEntity } from '../../pins/entities/pin.entity';

/**
 * Visit · 计划/拜访点统一实体(β.2.5 + β.3 升级)
 *
 * 4 种合法身份:
 * - parentPinId NULL  + status completed = 化身拜访(老 β.1 数据)
 * - parentPinId NULL  + status planned   = 化身计划
 * - parentPinId NOT   + status planned   = 项目下计划点(蓝点 = β.3)
 * - parentPinId NOT   + status completed = 项目下拜访点(转色后)
 *
 * 状态机:
 *   planned ↔ cancelled
 *   planned → completed (不可逆)
 *   completed → * (全禁,只允许改 visitColor)
 */
@Entity('visits')
@Index(['visitorId'])
@Index(['provinceCode'])
@Index(['visitDate'])
@Index(['parentPinId'])
@Index(['status'])
export class VisitEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // β.2.5 / β.3 新增 4 字段
  @Column({
    type: 'enum',
    enum: ['planned', 'completed', 'cancelled'],
    enumName: 'visit_status',
    default: 'completed',
  })
  status!: VisitStatus;

  @Column({ type: 'uuid', nullable: true, name: 'parent_pin_id' })
  parentPinId!: string | null;

  @ManyToOne(() => PinEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent_pin_id' })
  parentPin?: PinEntity;

  @Column({ type: 'varchar', length: 100, nullable: true })
  title!: string | null;

  @Column({ type: 'date', nullable: true, name: 'planned_date' })
  plannedDate!: string | null;

  // 业务字段(planned 时全部可空,completed 时部分必填)
  @Column({ type: 'date', nullable: true, name: 'visit_date' })
  visitDate!: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  department!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'contact_person' })
  contactPerson!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'contact_title' })
  contactTitle!: string | null;

  @Column({ type: 'text', nullable: true, name: 'outcome_summary' })
  outcomeSummary!: string | null;

  @Column({
    type: 'enum',
    enum: ['red', 'yellow', 'green', 'blue'],
    enumName: 'visit_color',
    nullable: true,
  })
  color!: VisitStatusColor | null;

  // followUp: 默认 false,任何状态下都有合法默认值,不 nullable
  @Column({ type: 'boolean', default: false, name: 'follow_up' })
  followUp!: boolean;

  // 地理字段(NOT NULL — 创建时由 city center lookup 强制填)
  @Column({ type: 'varchar', length: 6, name: 'province_code' })
  provinceCode!: string;

  @Column({ type: 'varchar', length: 64, name: 'city_name' })
  cityName!: string;

  @Column({ type: 'double precision' })
  lng!: number;

  @Column({ type: 'double precision' })
  lat!: number;

  // 系统字段
  @Column({ type: 'uuid', name: 'visitor_id' })
  visitorId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'visitor_id' })
  visitor?: UserEntity;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
