import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from './data-source';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...dataSourceOptions,
        url: config.get<string>('DATABASE_URL') ?? dataSourceOptions.url,
      }),
    }),
  ],
})
export class DatabaseModule {}
