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
import type { VisitStatusColor } from '@pop/shared-types';
import { UserEntity } from '../../users/entities/user.entity';

/**
 * Visit · 拜访记录(PRD §3.3 B2)
 *
 * MVP β.1:7 业务 + 4 地理 + visitor_id FK to users + 系统时间戳
 * Color 走自定义 PG enum visit_color (red/yellow/green),
 * 跟 shared-types/enums/visit-color.ts(4 档,含 blue 占位)解耦,
 * 因为 blue 是 PlanPoint 蓝点(β.3),Visit 表不存 blue。
 */
@Entity('visits')
@Index(['visitorId'])
@Index(['provinceCode'])
@Index(['visitDate'])
export class VisitEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // 业务字段(7)
  @Column({ type: 'date', name: 'visit_date' })
  visitDate!: string;

  @Column({ type: 'varchar', length: 128 })
  department!: string;

  @Column({ type: 'varchar', length: 64, name: 'contact_person' })
  contactPerson!: string;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'contact_title' })
  contactTitle!: string | null;

  @Column({ type: 'text', name: 'outcome_summary' })
  outcomeSummary!: string;

  @Column({ type: 'enum', enum: ['red', 'yellow', 'green'], enumName: 'visit_color' })
  color!: VisitStatusColor;

  @Column({ type: 'boolean', default: false, name: 'follow_up' })
  followUp!: boolean;

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
