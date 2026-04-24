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

export enum UserStatus {
  Active = 'active',
  Disabled = 'disabled',
  Pending = 'pending',
}

/**
 * 用户(PRD §4.2.1)
 *
 * 不冗余 `role` 字段(与 TECH-ARCH §5.1 修订一致):查询时 JOIN user_roles。
 * 不做 `region_default`:PRD §4.2.1 无此字段;登录后默认全国视图,用户自选属地。
 * 密码不存(SSO 对接,PRD §4.2.1 "数据说明")。
 */
@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 32 })
  username!: string;

  @Column({ type: 'varchar', length: 32, name: 'display_name' })
  displayName!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128 })
  email!: string;

  @Column({
    type: 'varchar',
    length: 256,
    nullable: true,
    name: 'avatar_url',
  })
  avatarUrl!: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  mobile!: string | null;

  @Column({
    type: 'enum',
    enum: UserStatus,
    enumName: 'user_status',
    default: UserStatus.Pending,
  })
  status!: UserStatus;

  @Column({ type: 'date', nullable: true, name: 'joined_at' })
  joinedAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  /** 创建人(PRD §4.0 默认字段,系统初始账号为 null) */
  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
  createdBy!: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator?: UserEntity | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
