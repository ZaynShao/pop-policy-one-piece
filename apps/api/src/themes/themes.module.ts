import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThemeEntity } from './entities/theme.entity';
import { ThemeCoverageEntity } from './entities/theme-coverage.entity';
import { ThemesController } from './themes.controller';
import { ThemesService } from './themes.service';
import { CoverageService } from './coverage.service';

@Module({
  imports: [TypeOrmModule.forFeature([ThemeEntity, ThemeCoverageEntity])],
  controllers: [ThemesController],
  providers: [ThemesService, CoverageService],
})
export class ThemesModule {}
