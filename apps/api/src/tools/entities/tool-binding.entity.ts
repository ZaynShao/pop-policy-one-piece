import {
  Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { BindingTarget, RegionScope } from '@pop/shared-types';
import { ToolEntity } from './tool.entity';
import { PinEntity } from '../../pins/entities/pin.entity';
import { VisitEntity } from '../../visits/entities/visit.entity';

@Entity('tool_bindings')
@Index(['toolId'])
@Index(['regionCode'])
export class ToolBindingEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tool_id' })
  toolId!: string;

  @ManyToOne(() => ToolEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tool_id' })
  tool?: ToolEntity;

  @Column({ type: 'enum', enum: ['pin', 'visit', 'region'], enumName: 'binding_target', name: 'target_type' })
  targetType!: BindingTarget;

  @Column({ type: 'uuid', nullable: true, name: 'pin_id' })
  pinId!: string | null;

  @ManyToOne(() => PinEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pin_id' })
  pin?: PinEntity;

  @Column({ type: 'uuid', nullable: true, name: 'visit_id' })
  visitId!: string | null;

  @ManyToOne(() => VisitEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'visit_id' })
  visit?: VisitEntity;

  @Column({ type: 'varchar', length: 8, nullable: true, name: 'region_code' })
  regionCode!: string | null;

  @Column({ type: 'enum', enum: ['nationwide', 'all_provinces', 'all_cities_in_province', 'all_districts_in_city', 'specific'], enumName: 'region_scope', nullable: true, name: 'region_scope_tag' })
  regionScopeTag!: RegionScope | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
