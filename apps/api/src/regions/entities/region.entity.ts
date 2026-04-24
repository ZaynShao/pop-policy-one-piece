import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum RegionLevel {
  Country = 'country',
  Province = 'province',
  City = 'city',
  District = 'district',
}

/**
 * 行政区划(PRD §4.2.3)
 *
 * 主键例外说明(TECH-ARCH §5.2):Region 用 6 位国标 `code` 作 PK,
 * 而非 UUID v7,因为 `parent_code` 自引用语义依赖 code。
 *
 * 国家层级约定:code `100000`(ECharts china.json 约定 + GB/T 2260 非正式用法)
 * MVP 版本:`version = '2023'`(PRD 明确不启用多版本机制)
 */
@Entity('regions')
@Index(['parentCode'])
@Index(['level'])
export class RegionEntity {
  @PrimaryColumn({ type: 'varchar', length: 6 })
  code!: string;

  @Column({ type: 'varchar', length: 64 })
  name!: string;

  @Column({
    type: 'enum',
    enum: RegionLevel,
    enumName: 'region_level',
  })
  level!: RegionLevel;

  @Column({ type: 'varchar', length: 6, nullable: true, name: 'parent_code' })
  parentCode!: string | null;

  @ManyToOne(() => RegionEntity, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'parent_code', referencedColumnName: 'code' })
  parent?: RegionEntity | null;

  @Column({ type: 'varchar', length: 16 })
  version!: string;

  @Column({ type: 'jsonb', nullable: true, name: 'geo_centroid' })
  geoCentroid!: { lng: number; lat: number } | null;

  @Column({
    type: 'varchar',
    length: 128,
    nullable: true,
    name: 'geojson_ref',
  })
  geojsonRef!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;
}
