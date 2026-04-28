import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { ThemeTemplate, ThemeStatus } from '@pop/shared-types';
import { UserEntity } from '../../users/entities/user.entity';
import { ThemeCoverageEntity } from './theme-coverage.entity';

@Entity('themes')
@Index(['status'])
@Index(['createdBy'])
export class ThemeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  title!: string;

  @Column({
    type: 'enum',
    enum: ['main', 'risk'],
    enumName: 'theme_template',
  })
  template!: ThemeTemplate;

  @Column({ type: 'text', array: true, default: '{}' })
  keywords!: string[];

  @Column({ type: 'text', nullable: true, name: 'region_scope' })
  regionScope!: string | null;

  @Column({
    type: 'enum',
    enum: ['draft', 'published', 'archived'],
    enumName: 'theme_status',
    default: 'draft',
  })
  status!: ThemeStatus;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'created_by' })
  creator?: UserEntity;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'published_at' })
  publishedAt!: Date | null;

  @OneToMany(() => ThemeCoverageEntity, (cov) => cov.theme)
  coverage?: ThemeCoverageEntity[];
}
