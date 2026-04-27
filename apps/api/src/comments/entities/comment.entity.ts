import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { CommentSource } from '@pop/shared-types';
import { PinEntity } from '../../pins/entities/pin.entity';
import { VisitEntity } from '../../visits/entities/visit.entity';
import { UserEntity } from '../../users/entities/user.entity';

/**
 * Comment · Pin 留言板留言(β.2.5)
 *
 * sourceType:
 * - 'manual' — Pin Drawer 用户手动留言
 * - 'auto_from_visit' — visits.update 把 status 从 planned → completed 时事务内自动 INSERT
 */
@Entity('comments')
@Index(['parentPinId', 'createdAt'])
export class CommentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'parent_pin_id' })
  parentPinId!: string;

  @ManyToOne(() => PinEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_pin_id' })
  parentPin?: PinEntity;

  @Column({
    type: 'enum',
    enum: ['manual', 'auto_from_visit'],
    enumName: 'comment_source',
    name: 'source_type',
  })
  sourceType!: CommentSource;

  @Column({ type: 'text' })
  body!: string;

  @Column({ type: 'uuid', nullable: true, name: 'linked_visit_id' })
  linkedVisitId!: string | null;

  @ManyToOne(() => VisitEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'linked_visit_id' })
  linkedVisit?: VisitEntity;

  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
  createdBy!: string | null;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'created_by' })
  creator?: UserEntity;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
