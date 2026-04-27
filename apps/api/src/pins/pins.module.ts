import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PinEntity } from './entities/pin.entity';
import { PinsController } from './pins.controller';
import { PinsService } from './pins.service';

@Module({
  imports: [TypeOrmModule.forFeature([PinEntity])],
  controllers: [PinsController],
  providers: [PinsService],
})
export class PinsModule {}
