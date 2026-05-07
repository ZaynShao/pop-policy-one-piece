import {
  Column, CreateDateColumn, DeleteDateColumn, Entity, Index,
  JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import type { ToolType, ToolStatus, ToolTaxonomy } from '@pop/shared-types';
import { UserEntity } from '../../users/entities/user.entity';

@Entity('tools')
@Index(['creatorId'])
@Index(['status', 'type'])
export class ToolEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: ['document', 'interface'], enumName: 'tool_type' })
  type!: ToolType;

  @Column({ type: 'varchar', length: 100 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'enum', enum: ['ppt_template', 'talk_param_ref', 'local_data', 'cooperation_template', 'policy_interpretation', 'other'], enumName: 'tool_taxonomy', name: 'taxonomy_tag' })
  taxonomyTag!: ToolTaxonomy;

  @Column({ type: 'enum', enum: ['draft', 'published', 'archived'], enumName: 'tool_status', default: 'draft' })
  status!: ToolStatus;

  @Column({ type: 'uuid', name: 'creator_id' })
  creatorId!: string;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'creator_id' })
  creator?: UserEntity;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'file_url' })
  fileUrl!: string | null;

  @Column({ type: 'jsonb', nullable: true, name: 'param_template' })
  paramTemplate!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true, name: 'response_mapping' })
  responseMapping!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt!: Date | null;
}
