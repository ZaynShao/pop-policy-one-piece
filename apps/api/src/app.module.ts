import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { RegionsModule } from './regions/regions.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : {
                target: 'pino-pretty',
                options: { singleLine: true, colorize: true },
              },
        customProps: () => ({ service: 'pop-api' }),
      },
    }),
    DatabaseModule,
    HealthModule,
    RegionsModule,
  ],
})
export class AppModule {}
