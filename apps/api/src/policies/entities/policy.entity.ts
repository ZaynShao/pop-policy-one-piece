import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { PolicyLevel } from '@pop/shared-types';
import { PolicyTopicEntity } from './policy-topic.entity';

@Entity('policies')
@Index(['level'])
@Index(['provinceCode'])
@Index(['provinceCode', 'cityName'])
@Unique('uq_policies_natural_key', ['title', 'issuingOrg', 'issueDate'])
export class PolicyEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 500 })
  title!: string;

  @Column({ type: 'varchar', length: 500, name: 'issuing_org' })
  issuingOrg!: string;

  @Column({ type: 'date', name: 'issue_date' })
  issueDate!: string;

  @Column({
    type: 'enum',
    enum: ['national', 'provincial', 'municipal', 'district'],
    enumName: 'policy_level',
  })
  level!: PolicyLevel;

  @Column({ type: 'varchar', length: 6, nullable: true, name: 'province_code' })
  provinceCode!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'city_name' })
  cityName!: string | null;

  @Column({ type: 'text' })
  summary!: string;

  @Column({ type: 'uuid', nullable: true, name: 'source_batch_id' })
  sourceBatchId!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @OneToMany(() => PolicyTopicEntity, (pt) => pt.policy)
  topics?: PolicyTopicEntity[];
}
