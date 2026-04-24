import 'reflect-metadata';
import { DataSource } from 'typeorm';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { config as loadEnv } from 'dotenv';
import { join } from 'node:path';

// CLI 模式(typeorm migration:xxx)时 ConfigModule 不跑,手动读 monorepo 根 .env。
// Nest 运行时 ConfigModule 已读过,此处重复读无害(dotenv 不覆盖已有环境变量)。
loadEnv({ path: join(__dirname, '../../../../.env') });

export const dataSourceOptions: PostgresConnectionOptions = {
  type: 'postgres',
  url:
    process.env.DATABASE_URL ??
    'postgresql://pop:pop_dev_password@localhost:5432/pop',
  entities: [join(__dirname, '../**/*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations/*.{ts,js}')],
  synchronize: false, // 严格走 migration
  migrationsRun: false,
  logging:
    process.env.NODE_ENV === 'production'
      ? ['error']
      : ['error', 'warn', 'migration'],
};

// CLI 入口(npm run typeorm -- migration:run 等)
// 必须是 default export 且只有一个 DataSource 实例(TypeORM CLI 约束)
export default new DataSource(dataSourceOptions);
