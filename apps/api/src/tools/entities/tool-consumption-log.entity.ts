import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ToolEntity } from './tool.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { PinEntity } from '../../pins/entities/pin.entity';
import { VisitEntity } from '../../visits/entities/visit.entity';

@Entity('tool_consumption_logs')
@Index(['consumerId', 'consumedAt'])
@Index(['toolId'])
export class ToolConsumptionLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tool_id' })
  toolId!: string;

  @ManyToOne(() => ToolEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tool_id' })
  tool?: ToolEntity;

  @Column({ type: 'uuid', name: 'consumer_id' })
  consumerId!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'consumer_id' })
  consumer?: UserEntity;

  @CreateDateColumn({ type: 'timestamptz', name: 'consumed_at' })
  consumedAt!: Date;

  @Column({ type: 'uuid', nullable: true, name: 'context_pin_id' })
  contextPinId!: string | null;

  @ManyToOne(() => PinEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'context_pin_id' })
  contextPin?: PinEntity;

  @Column({ type: 'uuid', nullable: true, name: 'context_visit_id' })
  contextVisitId!: string | null;

  @ManyToOne(() => VisitEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'context_visit_id' })
  contextVisit?: VisitEntity;

  @Column({ type: 'varchar', length: 8, nullable: true, name: 'context_region_code' })
  contextRegionCode!: string | null;

  @Column({ type: 'jsonb', nullable: true, name: 'interface_response' })
  interfaceResponse!: Record<string, unknown> | null;
}
