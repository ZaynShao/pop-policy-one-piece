import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { ThemeRegionLevel } from '@pop/shared-types';
import { ThemeEntity } from './theme.entity';

@Entity('theme_coverage')
@Index(['themeId'])
@Index(['regionCode'])
export class ThemeCoverageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'theme_id' })
  themeId!: string;

  @ManyToOne(() => ThemeEntity, (t) => t.coverage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'theme_id' })
  theme?: ThemeEntity;

  @Column({ type: 'varchar', length: 6, name: 'region_code' })
  regionCode!: string;

  @Column({
    type: 'enum',
    enum: ['province', 'city', 'district'],
    enumName: 'theme_region_level',
    name: 'region_level',
  })
  regionLevel!: ThemeRegionLevel;

  @Column({ type: 'double precision', name: 'main_value' })
  mainValue!: number;

  @Column({ type: 'jsonb', nullable: true, name: 'extra_data' })
  extraData!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'last_fetched_at' })
  lastFetchedAt!: Date;
}
