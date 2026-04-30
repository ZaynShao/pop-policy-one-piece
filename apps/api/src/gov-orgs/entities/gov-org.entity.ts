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

export type GovOrgLevel = 'national' | 'provincial' | 'municipal' | 'district';

@Entity('gov_orgs')
@Index(['provinceCode', 'cityName'])
@Index(['shortName'])
export class GovOrgEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 80 })
  name!: string;

  @Column({ type: 'varchar', length: 30, nullable: true, name: 'short_name' })
  shortName!: string | null;

  @Column({ type: 'varchar', length: 6, name: 'province_code' })
  provinceCode!: string;

  @Column({ type: 'varchar', length: 50, name: 'city_name' })
  cityName!: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'district_name' })
  districtName!: string | null;

  @Column({
    type: 'enum',
    enum: ['national', 'provincial', 'municipal', 'district'],
    enumName: 'gov_org_level',
  })
  level!: GovOrgLevel;

  @Column({ type: 'uuid', nullable: true, name: 'parent_org_id' })
  parentOrgId!: string | null;

  @ManyToOne(() => GovOrgEntity, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent_org_id' })
  parent?: GovOrgEntity;

  @Column({ type: 'text', array: true, default: () => "'{}'", name: 'function_tags' })
  functionTags!: string[];

  @Column({ type: 'varchar', length: 200, nullable: true })
  address!: string | null;

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
