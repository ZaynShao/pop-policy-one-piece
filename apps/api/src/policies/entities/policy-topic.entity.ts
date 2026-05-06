import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { PolicyEntity } from './policy.entity';

@Entity('policy_topics')
@Index(['topic'])
export class PolicyTopicEntity {
  @PrimaryColumn({ type: 'uuid', name: 'policy_id' })
  policyId!: string;

  @PrimaryColumn({ type: 'varchar', length: 100 })
  topic!: string;

  @ManyToOne(() => PolicyEntity, (p) => p.topics, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'policy_id' })
  policy?: PolicyEntity;
}
