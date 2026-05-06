import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DistributionQueryDto {
  @IsString() @IsNotEmpty() @MaxLength(100)
  topic!: string;
}
