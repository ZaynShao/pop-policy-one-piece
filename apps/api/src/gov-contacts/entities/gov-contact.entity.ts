import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { GovOrgEntity } from '../../gov-orgs/entities/gov-org.entity';

export type ContactTier = 'core' | 'important' | 'normal';

@Entity('gov_contacts')
@Index(['orgId'])
@Index(['ownerUserId'])
export class GovContactEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  name!: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  gender!: string | null;

  @Column({ type: 'uuid', name: 'org_id' })
  orgId!: string;

  @ManyToOne(() => GovOrgEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'org_id' })
  org?: GovOrgEntity;

  @Column({ type: 'varchar', length: 50 })
  title!: string;

  @Column({
    type: 'enum',
    enum: ['core', 'important', 'normal'],
    enumName: 'contact_tier',
    default: 'normal',
  })
  tier!: ContactTier;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  wechat!: string | null;

  @Column({ type: 'text', nullable: true, name: 'preference_notes' })
  preferenceNotes!: string | null;

  @Column({ type: 'uuid', name: 'owner_user_id' })
  ownerUserId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'owner_user_id' })
  owner?: UserEntity;

  @Column({ type: 'timestamptz', nullable: true, name: 'last_engaged_at' })
  lastEngagedAt!: Date | null;

  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
  createdBy!: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator?: UserEntity;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt!: Date | null;
}
