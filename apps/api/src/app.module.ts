import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module';
import { CaslModule } from './casl/casl.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { RegionsModule } from './regions/regions.module';
import { UsersModule } from './users/users.module';
import { VisitsModule } from './visits/visits.module';
import { PinsModule } from './pins/pins.module';
import { CommentsModule } from './comments/comments.module';
import { ThemesModule } from './themes/themes.module';
import { VoiceModule } from './voice/voice.module';

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
    CaslModule,
    UsersModule,
    AuthModule,
    HealthModule,
    RegionsModule,
    VisitsModule,
    PinsModule,
    CommentsModule,
    ThemesModule,
    VoiceModule,
  ],
  providers: [
    // 全局 JWT 守卫,@Public() 可跳过
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
